# SALT text-monitor validation

This benchmark trains a new communication-only monitoring baseline. It does not measure the existing Buzzer incident engine or prove wild-swarm detection.

The first frozen result is in `output/salt-validation-20261004/REPORT.txt`. The source release remains unchanged in `agent-collusion/`. Split files, separately stored labels, models, hashes, first-run predictions, grouped uncertainty and error records are retained under that output directory.

The split uses 30/10/10 whole task-sequence groups across every condition. Sequence 1, previously inspected, is training. All Claude routes are excluded from fitting and tuning. A second model excludes record-extraction episodes during fitting and evaluates that category separately. Main test tasks are substantially reused across other training sequences; this is explicitly audited.

The targets are released valid agreement-judge annotations and constrained joint-protocol-violation outcomes. Neither target independently establishes causal peer influence. No current verdicts, rewards, correctness, judge annotations, post-verdict reflections, future episodes or model metadata enter learned features. Current communication can naturally discuss prior actions and rewards.

Dependencies are isolated under `output/salt-validation-20261004/deps`; Python packages and version records are preserved. Node and the historical incident code are unaffected.

From `the repository root`, inspect an episode containing `communication: [{round, sender, content}, ...]`:

```powershell
python src/salt-validation/score.py episode.json --target agreement
```

`--target joint_violation` gives the constrained-laboratory violation prediction. These are review candidates with an uncalibrated score, not established violations. Missing communication yields abstention; a low score does not establish safety. Explicit policy and independent action evidence are still necessary before incident findings or responses.

The original stages were `benchmark.py prepare`, `benchmark.py train`, then `benchmark.py evaluate`; each refuses to replace frozen artifacts. Do not rerun by deleting the guards or retune on the test result. A subsequent experiment needs a separately defined protocol, fresh holdout and output location.

Run meaningful checks:

```powershell
python -m unittest discover -s test/salt-validation -v
```

Public sources: [SALT dataset](https://huggingface.co/datasets/SALT-NLP/agent-collusion), [paper/code](https://github.com/SALT-NLP/agent-collusion). The dataset MIT license remains with the source release; retain attribution on reuse. A real external validation should prospectively capture new agent behavior, policy, telemetry and blinded annotations rather than treating this public laboratory holdout as field validation.
