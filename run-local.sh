#!/bin/bash

# Gemini CLI Local Runner
# This script runs the locally built Gemini CLI

cd "$(dirname "$0")"
node bundle/gemini.js "$@"


