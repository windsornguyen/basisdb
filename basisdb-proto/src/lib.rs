//! Protocol-level data structures shared between services.

use basisdb_core::SharedString;
use serde::{Deserialize, Serialize};

/// Generated ConnectRPC protocol types and clients.
#[allow(warnings)]
pub mod generated {
    connectrpc::include_generated!("_basisdb_connect.rs");
}

/// Identifies a tenant within the global system.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct TenantId(pub SharedString);

/// A thin wrapper for user-supplied database names.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct DatabaseName(pub SharedString);
