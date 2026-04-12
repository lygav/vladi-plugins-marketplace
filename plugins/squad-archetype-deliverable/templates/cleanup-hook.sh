#!/bin/bash
# Deliverable archetype cleanup — runs on --reset
rm -f deliverable.json SCAN_SUMMARY.md
rm -rf raw/*
echo "✓ Deliverable artifacts cleared"
