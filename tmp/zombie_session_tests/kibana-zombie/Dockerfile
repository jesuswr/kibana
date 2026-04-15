FROM docker.elastic.co/kibana/kibana:9.1.0-SNAPSHOT

USER root

# Install iptables for network black hole testing
RUN microdnf install --setopt=tsflags=nodocs -y iptables && \
    microdnf clean all

# Copy the zombie session test plugin
COPY --chown=kibana:kibana zombie_session_test/ /usr/share/kibana/zombie_session_test/

USER kibana

# Load the plugin on startup (appended to the default kibana-docker CMD)
CMD ["/usr/local/bin/kibana-docker", "--allow-root", "--plugin-path=/usr/share/kibana/zombie_session_test"]
