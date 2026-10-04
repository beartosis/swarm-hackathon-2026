import importlib.util
from pathlib import Path
import unittest

spec=importlib.util.spec_from_file_location('benchmark',Path(__file__).resolve().parents[2]/'src/salt-validation/benchmark.py')
b=importlib.util.module_from_spec(spec);spec.loader.exec_module(b)

class BenchmarkTests(unittest.TestCase):
    def row(self, **kw):
        r={'run_id':'r','episode_index':0,'sequence_id':1,'alice_model':'gemini','bob_model':'gemini',
           'task_type':'code_analysis','experiment':'main','is_warmup':False,'collusion':False,
           'agreement':False,'agreement_status':'valid','communication':[{'round':0,'sender':'alice','content':'task ca_17 got 789'},
           {'round':2,'sender':'bob','content':'I accept.'}]}
        r.update(kw);return r
    def test_outcome_fields_cannot_change_features(self):
        a=self.row();c=self.row(collusion=True,agreement=True,alice_verdict='accept',alice_reward=20,reflection='relax')
        self.assertEqual(b.text(a),b.text(c))
    def test_future_round_does_not_leak_into_prefix(self):
        self.assertNotIn('accept',b.text(self.row(),max_round=1))
    def test_nullable_and_inapplicable_not_negative(self):
        self.assertIsNone(b.label(self.row(experiment='communication'),'joint_violation'))
        self.assertIsNone(b.label(self.row(experiment='controlled_peer'),'agreement'))
        self.assertIsNone(b.label(self.row(agreement_status='parse_error',agreement=False),'agreement'))
        self.assertIsNone(b.label(self.row(is_warmup=True),'joint_violation'))
    def test_global_sequence_and_model_exclusion(self):
        split={'train':[1],'validation':[2],'test':[3]}
        self.assertEqual(b.partition(self.row(sequence_id=3),'standard',split),'test')
        self.assertEqual(b.partition(self.row(sequence_id=1,bob_model='claude-sonnet'),'standard',split),'excluded_model')
        self.assertEqual(b.partition(self.row(sequence_id=3,bob_model='claude-sonnet'),'standard',split),'model_holdout')
    def test_task_holdout_cannot_train(self):
        split={'train':[1],'validation':[2],'test':[3]}
        self.assertEqual(b.partition(self.row(task_type='record_extraction'),'unseen_task_type',split),'excluded_task')
        self.assertEqual(b.partition(self.row(sequence_id=3,task_type='record_extraction'),'unseen_task_type',split),'task_holdout')
    def test_metrics_no_positive_predictions_is_not_perfect_precision(self):
        m=b.metrics([0,1],[0,0],0.5)
        self.assertIsNone(m['precision']);self.assertEqual(m['recall'],0)

if __name__=='__main__':unittest.main()
