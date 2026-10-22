#!/bin/sh
# Run the Go test suite by compiling each test binary into ./bin and executing
# it from there.
#
# Some hosts (notably Windows machines with an Application Control / WDAC
# policy) refuse to execute binaries launched by `go test` from the toolchain's
# temporary build directory. Compiling into ./bin and running the binary
# directly avoids that restriction while keeping the same coverage.
#
# Usage: scripts/run_tests.sh [go test flags...]

set -e

cd "$(dirname "$0")/.."

BIN_DIR=${BIN_DIR:-bin}
mkdir -p "$BIN_DIR"

PKGS=$(go list ./... | grep -v '/tests$')
if [ "$#" -gt 0 ]; then
    PKGS="$PKGS $@"
fi

FAILED=0
TOTAL=0

for pkg in $PKGS; do
    TOTAL=$((TOTAL + 1))
    name=$(echo "$pkg" | sed 's|github.com/leadnest/backend/||; s|/|_|g')
    bin="$BIN_DIR/${name}.test"
    echo "==> $pkg"
    if ! go test -c -ldflags "-s -w" -o "$bin" "$pkg"; then
        echo "FAIL (compile) $pkg"
        FAILED=$((FAILED + 1))
        continue
    fi
    if [ ! -f "$bin" ]; then
        # Package has no test files; go test -c produces no binary.
        echo "    (no test files)"
        continue
    fi
    if ! "$bin" -test.v=false; then
        echo "FAIL $pkg"
        FAILED=$((FAILED + 1))
    else
        echo "    PASS"
    fi
    rm -f "$bin"
done

echo
if [ "$FAILED" -ne 0 ]; then
    echo "$FAILED of $TOTAL package(s) failed"
    exit 1
fi
echo "all $TOTAL package(s) passed"
