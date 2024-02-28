FROM bufbuild/buf:1.29.0
ENTRYPOINT []

ARG PROTOC_VERSION="25.3"
ADD --chmod=777 install_protoc.sh /tmp/install_protoc.sh
RUN /tmp/install_protoc.sh "$PROTOC_VERSION"
RUN rm /tmp/install_protoc.sh
ENV PATH="${PATH}:/opt/protoc/bin"

