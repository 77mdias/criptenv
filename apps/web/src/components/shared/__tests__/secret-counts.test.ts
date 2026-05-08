import {
  applySecretCountMetadata,
  setEnvironmentSecretMetadata,
  syncSecretCountState,
} from "../secret-counts"

describe("secretCounts helpers", () => {
  it("initializes counts and versions from loaded environments", () => {
    const state = syncSecretCountState([
      { id: "production", secrets_count: 2, secrets_version: 3 },
      { id: "development", secrets_count: 8, secrets_version: 5 },
      { id: "staging", secrets_count: 0, secrets_version: 1 },
    ])

    expect(state).toEqual({
      counts: {
        production: 2,
        development: 8,
        staging: 0,
      },
      versions: {
        production: 3,
        development: 5,
        staging: 1,
      },
    })
  })

  it("preserves known counts when switching environments", () => {
    const previousState = {
      counts: {
        production: 2,
        development: 8,
        staging: 0,
      },
      versions: {
        production: 3,
        development: 5,
        staging: 1,
      },
    }

    const state = syncSecretCountState(
      [
        { id: "production", secrets_count: 0, secrets_version: 3 },
        { id: "development", secrets_count: 0, secrets_version: 5 },
        { id: "staging", secrets_count: 0, secrets_version: 1 },
      ],
      previousState
    )

    expect(state).toEqual(previousState)
  })

  it("hydrates exact counts from metadata before the vault is unlocked", () => {
    const initialState = syncSecretCountState([
      { id: "production", secrets_version: 3 },
      { id: "development", secrets_version: 5 },
      { id: "staging", secrets_version: 1 },
    ])

    const hydratedState = applySecretCountMetadata(initialState, [
      { environmentId: "production", count: 2, version: 3 },
      { environmentId: "development", count: 8, version: 5 },
      { environmentId: "staging", count: 0, version: 1 },
    ])

    expect(hydratedState.counts).toEqual({
      production: 2,
      development: 8,
      staging: 0,
    })
  })

  it("updates the active environment count after create, import, or delete", () => {
    const initialState = {
      counts: {
        production: 2,
        development: 8,
        staging: 0,
      },
      versions: {
        production: 3,
        development: 5,
        staging: 1,
      },
    }

    const afterCreate = setEnvironmentSecretMetadata(initialState, "staging", 1, 2)
    const afterImport = setEnvironmentSecretMetadata(afterCreate, "staging", 4, 3)
    const afterDelete = setEnvironmentSecretMetadata(afterImport, "staging", 3, 4)

    expect(afterCreate).toEqual({
      counts: {
        production: 2,
        development: 8,
        staging: 1,
      },
      versions: {
        production: 3,
        development: 5,
        staging: 2,
      },
    })
    expect(afterImport).toEqual({
      counts: {
        production: 2,
        development: 8,
        staging: 4,
      },
      versions: {
        production: 3,
        development: 5,
        staging: 3,
      },
    })
    expect(afterDelete).toEqual({
      counts: {
        production: 2,
        development: 8,
        staging: 3,
      },
      versions: {
        production: 3,
        development: 5,
        staging: 4,
      },
    })
  })

  it("ignores stale metadata that arrives after a newer local update", () => {
    const currentState = {
      counts: {
        production: 2,
        development: 8,
        staging: 4,
      },
      versions: {
        production: 3,
        development: 5,
        staging: 4,
      },
    }

    const nextState = applySecretCountMetadata(currentState, [
      { environmentId: "staging", count: 1, version: 2 },
    ])

    expect(nextState).toEqual(currentState)
  })

  it("accepts metadata from the same or newer version", () => {
    const currentState = {
      counts: {
        production: 0,
      },
      versions: {
        production: 3,
      },
    }

    const nextState = applySecretCountMetadata(currentState, [
      { environmentId: "production", count: 2, version: 3 },
    ])

    expect(nextState).toEqual({
      counts: {
        production: 2,
      },
      versions: {
        production: 3,
      },
    })
  })
})
