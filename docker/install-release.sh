#!/bin/sh
set -eu

repository="$1"
tag="$2"
asset_prefix="$3"
binary="$4"

case "$(uname -m)" in
  x86_64) target="x86_64-unknown-linux-gnu" ;;
  aarch64 | arm64) target="aarch64-unknown-linux-gnu" ;;
  *) echo "Unsupported architecture: $(uname -m)" >&2; exit 1 ;;
esac

asset="${asset_prefix}-${target}.tar.gz"
base_url="https://github.com/${repository}/releases/download/${tag}"
work_dir="$(mktemp -d)"

curl -fsSL -o "${work_dir}/${asset}" "${base_url}/${asset}"
curl -fsSL -o "${work_dir}/${asset}.sha256" "${base_url}/${asset}.sha256"

expected="$(cut -d ' ' -f 1 "${work_dir}/${asset}.sha256")"
actual="$(sha256sum "${work_dir}/${asset}" | cut -d ' ' -f 1)"
if [ "${expected}" != "${actual}" ]; then
  echo "Checksum mismatch for ${asset}" >&2
  exit 1
fi

tar -xzf "${work_dir}/${asset}" -C "${work_dir}"
find "${work_dir}" -type f -name "${binary}" -exec install -m 0755 {} /usr/local/bin/ \;
rm -rf "${work_dir}"
command -v "${binary}"
