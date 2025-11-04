from langflow.load import run_flow_from_json
import os

FLOW_PATH = os.path.join(os.path.dirname(__file__), "flow_export.json")

def run_langflow(inputs: dict):
    """
    Run the Langflow flow with dynamic inputs.
    Example: {"text": "Translate this", "language": "arabic"}
    """
    try:
        response = run_flow_from_json(flow=FLOW_PATH, input_value=inputs)
        return response
    except Exception as e:
        print("Langflow error:", e)
        return {"error": str(e)}