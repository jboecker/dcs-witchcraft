describe "StateTree", ->

  describe "single state", ->
    root = null
    sc = null
    # TODO: this is an angularism
    beforeEach module('yapTV.statechart')
    beforeEach inject((statetree) ->
      root = statetree().root
      sc = root.statechart
    )

    testChild = (child) ->
      expect(child.childStates.length).toBe(0)
    testAnyState = (state) ->
      expect(state.statechart).toNotBe(undefined)
    isCurrentState = (state) ->
      expect(lodash.pluck(sc.currentStates(), 'name').indexOf(state.name)).toNotBe(-1)

    it "root", ->
      expect(root.name).toBe("root")
      testChild(root)
      expect(root.parentState).toBe(undefined)
      testAnyState(root)

      isCurrentState(root)
      expect(sc.activeStates().length).toBe(1)
      #expect(root.goTo().statechart.currentStates()[0]).toBe(root)
      #expect(sc.activeStates().length).toBe(1)

    it "one sub state", ->
      sub1 = root.subState("sub1")
      expect(sub1.name).toBe("sub1")
      testChild(sub1)
      testAnyState(sub1)
      isCurrentState(root)
      expect(sc.activeStates().length).toBe(1)
      sub1.goTo()
      isCurrentState(sub1)
      expect(sc.activeStates().length).toBe(2)

    it "two sub states", ->
      sub1 = root.subState("sub1")
      sub2 = root.subState("sub2")
      expect(sub2.name).toBe("sub2")
      testChild(sub2)
      testAnyState(sub2)
      expect(sub2.statechart.currentStates()[0]).toBe(root)
      expect(sc.activeStates().length).toBe(1)

      sub2.goTo()
      isCurrentState(sub2)
      expect(sc.activeStates().length).toBe(2)
      expect(sc.activeStates()).toContain(root)
      expect(sc.activeStates()).toContain(sub2)

      sub1.goTo()
      isCurrentState(sub1)
      expect(sc.activeStates().length).toBe(2)
      expect(sc.activeStates()).toContain(root)
      expect(sc.activeStates()).toContain(sub1)

    it "sub state of sub states", ->
      sub1 = root.subState("sub1")
      sub2 = root.subState("sub2")
      subsub1 = sub1.subState("subsub1")
      expect(subsub1.name).toBe("subsub1")
      testChild(subsub1)
      testAnyState(subsub1)
      isCurrentState(root)
      expect(sc.activeStates().length).toBe(1)
      subsub1.goTo()
      isCurrentState(subsub1)
      expect(sc.activeStates().length).toBe(3)

    it "concurrent sub states", ->
      root.concurrentSubStates()
      sub1 = root.subState("sub1")
      sub2 = root.subState("sub2")
      expect(sub2.name).toBe("sub2")
      testChild(sub2)
      testAnyState(sub2)
      isCurrentState(root)
      expect(sc.activeStates().length).toBe(1)

      sub2.goTo()
      isCurrentState(sub2)
      expect(sc.activeStates().length).toBe(2)
      expect(sc.activeStates()).toContain(root)
      expect(sc.activeStates()).toContain(sub2)

      sub1.goTo()
      isCurrentState(sub1)
      expect(sc.activeStates().length).toBe(3)
      expect(sc.activeStates()).toContain(root)
      isCurrentState(sub1)
      isCurrentState(sub2)
