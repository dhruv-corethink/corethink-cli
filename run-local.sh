#!/bin/bash

# CoreThink CLI Local Runner
# This script runs the locally built CoreThink CLI

cd "$(dirname "$0")"
node bundle/corethink.js "$@"


