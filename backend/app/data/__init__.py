"""Static reference (master) data for ports, vessels and sea distances.

IMPORTANT DATA-PROVENANCE NOTE
------------------------------
No external/live APIs are used anywhere in this project. Every value in
this package is either:

  * "PUBLIC_REFERENCE_DEMO" — a figure aligned with publicly published port
    handbooks / vessel class conventions, reproduced here for demonstration
    and NOT verified against a live authority feed, or
  * "DEMO_ASSUMED" — an explicitly assumed modelling value.

Nothing in this package is live operational data and the API always echoes
`data_source` + `data_timestamp` so a consumer can never mistake demo
values for real-time truth.
"""
