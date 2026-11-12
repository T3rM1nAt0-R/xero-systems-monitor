# Security policy

## Reporting a problem

Please do not report security problems in public issues or pull requests.

Report them privately through GitHub: **Security > Report a vulnerability** on this repository.

Include the version or commit, steps to reproduce, and what an attacker could do. We will reply, fix it privately, and credit you unless you prefer not to be named.

## How the app is meant to be safe

- The collector listens only on `127.0.0.1` and checks the `Host` header.
- It never stores SSH passwords or keys. It uses your existing SSH setup.
- The optional sensors helper is the only part that needs administrator rights. It is off by default, reads sensors only, and talks to the app over a local pipe.
- No telemetry.

## Supported versions

Only the latest release gets security fixes.
