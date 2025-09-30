# Copyright 2025 Marcelo Parisi (github.com/feitnomore)
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# Node/Angular Builder
FROM node:22.5.1-bookworm as builder
LABEL org.opencontainers.image.authors="marcelo@feitoza.com.br"
LABEL description="Kubevirt Manager nightly - Builder"

WORKDIR /usr/src/app
COPY . /usr/src/app
RUN cd /usr/src/app/src/assets/ && git clone https://github.com/novnc/noVNC.git
RUN cd /usr/src/app && npm install -g npm@10.8.2 && npm run clean && npm install -g @angular/cli@18.1.1 && npm install && npm run build

# OAUTH2 IMAGE
FROM quay.io/oauth2-proxy/oauth2-proxy:latest AS oauth2_proxy_downloader

# NGINX Image
FROM nginx:1.28-alpine

LABEL org.opencontainers.image.authors="marcelo@feitoza.com.br"
LABEL description="Kubevirt Manager nightly"

COPY --from=oauth2_proxy_downloader /bin/oauth2-proxy /bin/oauth2-proxy
COPY --from=oauth2_proxy_downloader /etc/ssl/private/jwt_signing_key.pem /etc/ssl/private/jwt_signing_key.pem

RUN mkdir -p /etc/nginx/location.d/ && mkdir -p /etc/nginx/oauth.d/
RUN curl -LO https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl && \
    chmod +x ./kubectl && mv ./kubectl /usr/local/bin

COPY entrypoint/90-oauth-proxy.sh /docker-entrypoint.d
COPY entrypoint/91-startkubectl.sh /docker-entrypoint.d
COPY conf/default.conf /etc/nginx/conf.d/
COPY conf/gzip.conf /etc/nginx/conf.d/

RUN chmod +x /docker-entrypoint.d/90-oauth-proxy.sh && chmod +x /docker-entrypoint.d/91-startkubectl.sh

COPY --from=builder /usr/src/app/dist/kubevirtmgr-webui/browser /usr/share/nginx/html
