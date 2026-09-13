//! Bounded, ordered metadata pages over the committed KV state.

use basisdb_proto::generated::basisdb::kv::v1::{
    HeadResponse, ListNamespacesResponse, ListResponse, Namespace,
};
use connectrpc::ConnectError;

use crate::command::{KvName, KvState, MAX_KEY_BYTES, MAX_NAMESPACE_BYTES, body_len};

pub(crate) fn page_limit(limit: u32) -> Result<usize, ConnectError> {
    match limit {
        0 => Ok(50),
        1..=100 => usize::try_from(limit)
            .map_err(|_| ConnectError::invalid_argument("page limit is not representable")),
        _ => Err(ConnectError::invalid_argument("page limit must not exceed 100")),
    }
}

pub(crate) fn validate_namespace_cursor(cursor: &str) -> Result<(), ConnectError> {
    if cursor.len() > MAX_NAMESPACE_BYTES {
        return Err(ConnectError::invalid_argument("namespace cursor exceeds 255-byte limit"));
    }
    Ok(())
}

pub(crate) fn validate_list(
    namespace: &str,
    prefix: &str,
    start_after: &str,
) -> Result<(), ConnectError> {
    if namespace.is_empty() || namespace.len() > MAX_NAMESPACE_BYTES {
        return Err(ConnectError::invalid_argument("namespace must contain 1 to 255 bytes"));
    }
    if prefix.len() > MAX_KEY_BYTES || start_after.len() > MAX_KEY_BYTES {
        return Err(ConnectError::invalid_argument("prefix and cursor must not exceed 1024 bytes"));
    }
    Ok(())
}

pub(crate) fn namespaces(
    state: &KvState,
    start_after: &str,
    limit: usize,
) -> Result<ListNamespacesResponse, ConnectError> {
    let start = KvName { namespace: start_after.to_owned(), key: String::new() };
    let mut page: Vec<Namespace> = Vec::new();
    let mut next_start_after = String::new();
    for (name, _) in state.entries.range(start..) {
        if name.namespace == start_after {
            continue;
        }
        if page.last().is_none_or(|last| last.name != name.namespace) {
            if page.len() == limit {
                next_start_after.clone_from(&page[limit - 1].name);
                break;
            }
            page.push(Namespace { name: name.namespace.clone(), ..Default::default() });
        }
        let index = page.len() - 1;
        page[index].key_count = page[index]
            .key_count
            .checked_add(1)
            .ok_or_else(|| ConnectError::resource_exhausted("namespace key count overflow"))?;
    }
    Ok(ListNamespacesResponse { namespaces: page, next_start_after, ..Default::default() })
}

pub(crate) fn entries(
    state: &KvState,
    namespace: &str,
    prefix: &str,
    start_after: &str,
    limit: usize,
) -> Result<ListResponse, ConnectError> {
    let start = KvName { namespace: namespace.to_owned(), key: prefix.max(start_after).to_owned() };
    let mut page: Vec<HeadResponse> = Vec::new();
    let mut next_start_after = String::new();
    for (name, record) in state.entries.range(start..) {
        if name.namespace != namespace || !name.key.starts_with(prefix) {
            break;
        }
        if name.key.as_str() <= start_after {
            continue;
        }
        if page.len() == limit {
            next_start_after.clone_from(&page[limit - 1].key);
            break;
        }
        page.push(HeadResponse {
            namespace: name.namespace.clone(),
            key: name.key.clone(),
            etag: record.etag.clone(),
            generation: record.generation,
            size: body_len(&record.body)?,
            ..Default::default()
        });
    }
    Ok(ListResponse { entries: page, next_start_after, ..Default::default() })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::command::KvRecord;

    fn fixture() -> KvState {
        let mut state = KvState::new();
        for namespace in ["alpha", "beta", "gamma"] {
            for key in ["user/2", "user/1", "config", "user/3"] {
                state.entries.insert(
                    KvName::new(namespace, key).unwrap(),
                    KvRecord { body: vec![42; 4], etag: "v1".into(), generation: 1 },
                );
            }
        }
        state
    }

    #[test]
    fn invariant_pages_partition_matching_keys_without_value_bodies() {
        let state = fixture();
        let first = entries(&state, "beta", "user/", "", 2).unwrap();
        assert_eq!(
            first.entries.iter().map(|row| row.key.as_str()).collect::<Vec<_>>(),
            ["user/1", "user/2"]
        );
        assert_eq!(first.next_start_after, "user/2");
        assert!(first.entries.iter().all(|row| row.namespace == "beta" && row.size == 4));
        let second = entries(&state, "beta", "user/", &first.next_start_after, 2).unwrap();
        assert_eq!(second.entries.len(), 1);
        assert_eq!(second.entries[0].key, "user/3");
        assert!(second.next_start_after.is_empty());
        assert!(entries(&state, "beta", "user/", "zzz", 2).unwrap().entries.is_empty());
    }

    #[test]
    fn invariant_namespace_pages_count_complete_namespaces() {
        let state = fixture();
        let first = namespaces(&state, "", 2).unwrap();
        assert_eq!(
            first.namespaces.iter().map(|ns| ns.name.as_str()).collect::<Vec<_>>(),
            ["alpha", "beta"]
        );
        assert!(first.namespaces.iter().all(|ns| ns.key_count == 4));
        let second = namespaces(&state, &first.next_start_after, 2).unwrap();
        assert_eq!(second.namespaces[0].name, "gamma");
        assert!(second.next_start_after.is_empty());
        assert!(namespaces(&state, "zzz", 2).unwrap().namespaces.is_empty());
    }

    #[test]
    fn invariant_unbounded_requests_are_rejected() {
        assert_eq!(page_limit(0).unwrap(), 50);
        assert!(page_limit(101).is_err());
        assert!(validate_list("", "", "").is_err());
        assert!(validate_list("a", &"x".repeat(MAX_KEY_BYTES + 1), "").is_err());
        assert!(validate_namespace_cursor(&"x".repeat(MAX_NAMESPACE_BYTES + 1)).is_err());
    }
}
