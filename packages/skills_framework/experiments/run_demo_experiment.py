import json
import asyncio
import os
import sys

# Add the 'packages' directory to PYTHONPATH
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from skills_framework.executor import SkillExecutor
from skills_framework.evaluator.direct_scoring import DirectScoringEvaluator, ScoringCriterion

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "../../../apps/agent-builder-backend/.env"))

async def run_experiment():
    print("Starting Demo Experiment...")

    # Load dataset
    dataset_path = os.path.join(os.path.dirname(__file__), "../datasets/test_cases.json")
    with open(dataset_path, "r", encoding="utf-8") as f:
        dataset = json.load(f)

    # Setup dummy skill and template
    skill_prompt = "Extract the following JSON based on the schema and input text. Schema: {template_schema}"
    parameters = {"model": "gpt-4o-mini", "temperature": 0.0}
    template_data = {
        "fields": [
            {"name": "units_reporting", "type": "list"},
            {"name": "times", "type": "list"},
            {"name": "needs", "type": "string"},
            {"name": "coordinates", "type": "string"}
        ]
    }

    executor = SkillExecutor()
    evaluator = DirectScoringEvaluator(model_name="gpt-4o-mini")
    
    criteria = [
        ScoringCriterion(
            name="JSON Adherence",
            description="The output must be valid JSON matching the provided schema.",
            weight=1.0,
            scale="1-5"
        ),
        ScoringCriterion(
            name="Factual Accuracy",
            description="The extracted fields must perfectly match the facts provided in the input text.",
            weight=1.5,
            scale="1-5"
        )
    ]

    results = []

    for item in dataset:
        print(f"Executing test case: {item['name']}...")
        exec_result = await executor.execute(
            skill_prompt=skill_prompt,
            parameters=parameters,
            template_data=template_data,
            user_input=item["input"]
        )
        
        if exec_result["success"]:
            output_str = json.dumps(exec_result["output"])
            print(f"Scoring output for {item['name']}...")
            
            eval_input = f"Expected Output: {json.dumps(item['expected'])}\n\nActual Extracted Output: {output_str}"
            
            score_result = evaluator.evaluate(
                prompt="Score the extracted output against the expected output.",
                response=eval_input,
                criteria=criteria
            )
            
            results.append({
                "test_case": item["name"],
                "execution_output": exec_result["output"],
                "evaluation_scores": [s.dict() for s in score_result.scores]
            })
        else:
            print(f"Execution failed for {item['name']}: {exec_result.get('error')}")

    # Output report
    report_path = os.path.join(os.path.dirname(__file__), "demo_report.json")
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
        
    print(f"Experiment complete. Report saved to {report_path}")

if __name__ == "__main__":
    asyncio.run(run_experiment())
