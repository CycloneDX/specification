#!/usr/bin/env sh
set -ue

PROTOC_VERSION="$1"

REMOTE_PATTERN="https://github.com/protocolbuffers/protobuf/releases/download/v${PROTOC_VERSION}/protoc-${PROTOC_VERSION}-linux-{ARCH}.zip"
# {ARCH} is one of: aarch_64 ppcle_64 s390_64 x86_32 x86_64

C_LONG_BIT="$(getconf LONG_BIT)"
M_ARCH="$(uname -m)"
case "${M_ARCH}" in
  'aarch64' | 'aarch64_be' | 'armv8b' | 'armv8l' | 'arm')
    if [ "$C_LONG_BIT" != '64' ]
    then
      echo "unsupported C_LONG_BIT: ${C_LONG_BIT}" >&2
      exit 2
    fi
    R_ARCH='aarch_64'
    ;;
  'ppc64le' | 'ppcle' | 'ppc64' | 'ppc')
    if [ "$C_LONG_BIT" != '64' ]
    then
      echo "unsupported C_LONG_BIT: ${C_LONG_BIT}" >&2
      exit 2
    fi
    R_ARCH='ppcle_64'
    ;;
  's390x' | 's390')
    if [ "$C_LONG_BIT" != '64' ]
    then
      echo "unsupported C_LONG_BIT: ${C_LONG_BIT}" >&2
      exit 2
    fi
    R_ARCH='s390_64'
    ;;
  'i386' | 'i686' | 'x86_64')
    if [ "$C_LONG_BIT" = '64' ]
    then
      R_ARCH='x86_64'
    else
      R_ARCH='x86_32'
    fi
    ;;
  *)
    echo "unmapped M_ARCH: ${M_ARCH}" >&2
    exit 1
    ;;
esac

REMOTE="$(echo "$REMOTE_PATTERN" | sed "s/{ARCH}/${R_ARCH}/")"
wget -qO- "${REMOTE}" | unzip -d /opt/protoc -
chmod a+x /opt/protoc/bin/protoc
