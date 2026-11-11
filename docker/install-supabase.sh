#!/bin/sh
set -eu

version="$1"
case "$(uname -m)" in
  x86_64) arch="amd64" ;;
  aarch64 | arm64) arch="arm64" ;;
  *) echo "Unsupported architecture: $(uname -m)" >&2; exit 1 ;;
esac

asset="supabase_${version}_linux_${arch}.tar.gz"
base_url="https://github.com/supabase/cli/releases/download/v${version}"
work_dir="$(mktemp -d)"

curl -fsSL -o "${work_dir}/${asset}" "${base_url}/${asset}"
curl -fsSL -o "${work_dir}/checksums.txt" "${base_url}/checksums.txt"
(cd "${work_dir}" && grep " ${asset}\$" checksums.txt | sha256sum -c -)

tar -xzf "${work_dir}/${asset}" -C "${work_dir}"
install -m 0755 "${work_dir}/supabase" /usr/local/bin/supabase
rm -rf "${work_dir}"
supabase --version
