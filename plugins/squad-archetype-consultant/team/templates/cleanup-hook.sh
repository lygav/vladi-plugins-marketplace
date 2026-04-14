#!/bin/bash
# Cleanup Hook — Reset archetype-specific state
#
# Called by core's reset command. Core clears common state (signals, acks, status.json).
# This hook clears archetype-specific state.

set -e

# Clear archetype-specific state here
# Example:
# rm -rf .squad/consultant/
# rm -f deliverable.json
# rm -rf raw/

echo "✅ Consultant archetype state cleared"
