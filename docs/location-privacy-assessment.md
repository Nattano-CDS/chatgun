# Location privacy assessment

Draft for owner, security, and legal review. No Production activation is authorized.

## Data flow and controls

The browser requests precise geolocation only after the member presses the location button.
The API rejects non-finite/out-of-range values and reported accuracy worse than 50 metres.
D1 stores latitude, longitude, reported accuracy, and timestamp only while discovery is
enabled. Other members never receive these fields. Discovery calculates distance at the
server and returns a coarse upper band: under 100 m, then 100-metre increments to 5 km.

Presence expires after 120 seconds. The browser republishes no more than about once per 55
seconds while visible. Hiding discovery, a denied permission, or an account deletion clears
coordinates; scheduled cleanup also clears stale records. A profile viewer cannot see the
accuracy or time of another member's location.

## Abuse analysis

- **Single query:** yields only a coarse annulus, not coordinates.
- **Repeated movement/triangulation:** still theoretically possible by sampling band changes.
  The server limits discovery to 60 reads per member per ten minutes, and blocking removes
  both parties from results immediately. This reduces but does not eliminate inference.
- **Multiple accounts/collusion:** per-user throttling is insufficient alone. Public launch
  needs device/IP anomaly detection that does not retain raw identifiers longer than the
  approved security window, plus detection of coordinated probing.
- **Small populations:** identity, time, and a 100-metre band may still reveal a home or
  workplace. Avoid background publication, provide a prominent off switch, and consider
  250–500 m bands or neighbourhood-level discovery outside dense public venues.
- **Ratings:** the server uses exact coordinates only to enforce the 100 m rule. The response
  does not reveal the calculated distance.

## Required decisions

Owner/security must choose whether 100 m is acceptable for the intended context; 250 m is
the recommended public default pending a stalking threat-model exercise. Legal review must
approve the purpose, notice, retention, and lawful basis. Before launch, add abuse alerts for
multi-account probing, rehearse location-related emergency reports, and run field tests in
dense and rural settings. Until then, discovery remains launch-gated.
