#!/bin/bash

echo "Running CardsService tests..."

# Run the e2e tests for cards
npm run test:e2e -- test/cards.e2e-spec.ts

# Also run unit tests
npm run test -- test/cards.service.spec.ts

echo "CardsService tests complete."
