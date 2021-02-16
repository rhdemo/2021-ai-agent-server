#!/usr/bin/env bash
printf "\n\n######## ai-agent-server build ########\n"

IMAGE_REPOSITORY=${IMAGE_REPOSITORY:-quay.io/redhatdemo/2021-ai-agent-server:latest}

rm -rf node_modules/
rm -rf build/

s2i build -c . registry.access.redhat.com/ubi8/nodejs-14 ${IMAGE_REPOSITORY}
