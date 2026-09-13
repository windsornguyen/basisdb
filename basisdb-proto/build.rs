fn main() -> Result<(), Box<dyn std::error::Error>> {
    connectrpc_build::Config::new()
        .files(&["proto/basisdb/kv/v1/kv.proto"])
        .includes(&["proto"])
        .include_file("_basisdb_connect.rs")
        .compile()?;
    Ok(())
}
