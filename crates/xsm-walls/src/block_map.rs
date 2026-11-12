//! Wall: each crate depends only on what `walls/block-map.toml` allows.

use crate::files::{crate_of, SourceFile};
use toml::{Table, Value};

const DEPENDENCY_TABLES: [&str; 3] = ["dependencies", "dev-dependencies", "build-dependencies"];

fn names_in(table: &Table, out: &mut Vec<String>) {
    for key in DEPENDENCY_TABLES {
        if let Some(Value::Table(deps)) = table.get(key) {
            out.extend(deps.keys().cloned());
        }
    }
}

/// Every dependency name a manifest declares, including per-target tables.
fn dependencies(manifest: &Table) -> Vec<String> {
    let mut out = Vec::new();
    names_in(manifest, &mut out);
    if let Some(Value::Table(targets)) = manifest.get("target") {
        for target in targets.values() {
            if let Value::Table(t) = target {
                names_in(t, &mut out);
            }
        }
    }
    out
}

/// Compare crate manifests (`crates/<name>/Cargo.toml`) with the allow-list.
#[must_use]
pub fn check(allow_list: &str, manifests: &[SourceFile]) -> Vec<String> {
    let allow: Table = match toml::from_str(allow_list) {
        Ok(t) => t,
        Err(e) => return vec![format!("walls/block-map.toml: {e}")],
    };
    let Some(Value::Table(blocks)) = allow.get("blocks") else {
        return vec!["walls/block-map.toml: missing [blocks] table".to_owned()];
    };
    let mut out = Vec::new();
    for m in manifests {
        let name = crate_of(&m.path).unwrap_or(&m.path);
        let Some(Value::Array(allowed)) = blocks.get(name) else {
            out.push(format!("{}: block {name} is not in the block map", m.path));
            continue;
        };
        let manifest: Table = match toml::from_str(&m.text) {
            Ok(t) => t,
            Err(e) => {
                out.push(format!("{}: {e}", m.path));
                continue;
            }
        };
        for dep in dependencies(&manifest) {
            if !allowed.iter().any(|a| a.as_str() == Some(dep.as_str())) {
                out.push(format!("{}: {name} may not depend on {dep}", m.path));
            }
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    const ALLOW: &str = "[blocks]\nxsm-core = [\"serde\"]\n";

    fn manifest(name: &str, deps: &str) -> SourceFile {
        SourceFile::new(&format!("crates/{name}/Cargo.toml"), deps)
    }

    #[test]
    fn fails_on_extra_dependency() {
        let bad = manifest(
            "xsm-core",
            "[dependencies]\nserde = \"1\"\nrand = \"0.8\"\n",
        );
        assert_eq!(check(ALLOW, &[bad]).len(), 1);
        let dev = manifest("xsm-core", "[dev-dependencies]\ntempfile = \"3\"\n");
        assert_eq!(check(ALLOW, &[dev]).len(), 1);
        let target = manifest(
            "xsm-core",
            "[target.'cfg(windows)'.dependencies]\nwindows = \"0.5\"\n",
        );
        assert_eq!(check(ALLOW, &[target]).len(), 1);
    }

    #[test]
    fn fails_on_unknown_block_and_bad_files() {
        assert_eq!(check(ALLOW, &[manifest("xsm-new", "")]).len(), 1);
        assert_eq!(check("[[[", &[]).len(), 1);
        assert_eq!(check("x = 1", &[]).len(), 1);
    }

    #[test]
    fn passes_on_allowed_dependencies() {
        let ok = manifest("xsm-core", "[dependencies]\nserde.workspace = true\n");
        assert!(check(ALLOW, &[ok]).is_empty());
    }
}
