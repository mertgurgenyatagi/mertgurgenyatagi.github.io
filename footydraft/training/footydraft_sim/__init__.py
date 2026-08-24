"""Python port of FootyDraft's rules engine (footydraft/src/lib/*Engine.ts), built for
self-play RL training rather than for the shipped app. See footydraft/GAME-RULES.md
for the spec this package implements, and footydraft/training/README.md for the
handful of deliberate simplifications made when porting real-time UI mechanics
(auction clock/lockout, wheel spin animation) into a step-based simulator.
"""
