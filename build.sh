#!/bin/bash
set -e

if [ -z "$1" ]; then
    echo "Usage: $0 <plugin-folder-name>"
    echo "Example: $0 official/sys-monitor"
    exit 1
fi

PLUGIN_NAME=$1

ROOT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PLUGIN_DIR="$ROOT_DIR/$PLUGIN_NAME"

# Smart directory lookup
if [ ! -d "$PLUGIN_DIR" ]; then
    if [ -d "$ROOT_DIR/official/$PLUGIN_NAME" ]; then
        PLUGIN_DIR="$ROOT_DIR/official/$PLUGIN_NAME"
        PLUGIN_NAME="official/$PLUGIN_NAME"
    elif [ -d "$ROOT_DIR/community/$PLUGIN_NAME" ]; then
        PLUGIN_DIR="$ROOT_DIR/community/$PLUGIN_NAME"
        PLUGIN_NAME="community/$PLUGIN_NAME"
    else
        echo "Error: Plugin directory '$PLUGIN_NAME' does not exist in $ROOT_DIR."
        exit 1
    fi
fi

echo "Building $PLUGIN_NAME plugin..."
cd "$PLUGIN_DIR"

if [ ! -f "Cargo.toml" ]; then
    echo "Error: Cargo.toml not found in $PLUGIN_DIR"
    exit 1
fi

cargo build --target wasm32-wasip1 --release

PACKAGE_NAME=$(grep '^name' Cargo.toml | head -n 1 | cut -d '"' -f 2)
if [ -z "$PACKAGE_NAME" ]; then
    PACKAGE_NAME=$(basename "$PLUGIN_NAME")
fi
WASM_NAME=$(echo "$PACKAGE_NAME" | tr '-' '_')

SOURCE_FILE="target/wasm32-wasip1/release/${WASM_NAME}.wasm"
RELEASE_DIR="release/${PLUGIN_NAME}"
DEST_FILE="$RELEASE_DIR/${WASM_NAME}.wasm"

mkdir -p "$RELEASE_DIR"

if [ -f "$SOURCE_FILE" ]; then
    cp "$SOURCE_FILE" "$DEST_FILE"
    sed -E 's|"main":\s*".*/(.*\.wasm)"|"main": "\1"|g' termax-plugin.json > "$RELEASE_DIR/termax-plugin.json"
    
    echo ""
    echo "✅ Build successful!"
    echo "The release-ready plugin is located at:"
    echo "   $PLUGIN_NAME/$RELEASE_DIR"
else
    echo "Error: Build output not found at $SOURCE_FILE"
    exit 1
fi
