import re
from playwright.sync_api import Page, expect

def test_multi_step_research_agent(page: Page):
    """
    E2E scenario for Agent Builder:
    1. Drag a Webhook Trigger
    2. Drag a Tool Node (Fetch URL)
    3. Drag an LLM Node (Summarize)
    4. Connect them sequentially
    5. Configure nodes
    6. Execute and check Status Overlay
    """

    # We assume 'npm run dev' and 'python manage.py demo' are running
    # 1. Navigate to a new blueprint canvas
    page.goto("http://localhost:5173/blueprints/new")
    
    # 2. Open Node Palette (assuming 'Core Primitives' is visible)
    # Drag Trigger Node
    trigger_item = page.locator("text='Trigger'")
    canvas = page.locator(".react-flow__pane")
    trigger_item.drag_to(canvas, target_position={"x": 100, "y": 100})
    
    # Drag Tool Node
    tool_item = page.locator("text='Tool'")
    tool_item.drag_to(canvas, target_position={"x": 400, "y": 100})

    # Drag LLM Node
    llm_item = page.locator("text='LLM'")
    llm_item.drag_to(canvas, target_position={"x": 700, "y": 100})

    # Drag Output Node
    output_item = page.locator("text='Output'")
    output_item.drag_to(canvas, target_position={"x": 1000, "y": 100})

    # 3. Connect Nodes
    # Connect Trigger -> Tool
    page.locator(".react-flow__node-trigger .react-flow__handle-right").drag_to(
        page.locator(".react-flow__node-tool .react-flow__handle-left")
    )
    # Connect Tool -> LLM
    page.locator(".react-flow__node-tool .react-flow__handle-right").drag_to(
        page.locator(".react-flow__node-llm .react-flow__handle-left")
    )
    # Connect LLM -> Output
    page.locator(".react-flow__node-llm .react-flow__handle-right").drag_to(
        page.locator(".react-flow__node-output .react-flow__handle-left")
    )

    # 4. Configure LLM Node
    # Select LLM Node
    page.locator(".react-flow__node-llm").click()
    
    # Wait for config panel to appear
    config_panel = page.locator("text='Configuration'")
    expect(config_panel).to_be_visible()
    
    # Enter system prompt
    system_prompt_input = page.locator("textarea[placeholder*='prompt']")
    system_prompt_input.fill("You are an expert technical researcher. Summarize the text provided from the previous step.")
    
    # 5. Execute 
    execute_btn = page.locator("button:has-text('Execute')")
    execute_btn.click()

    # Wait for the Execution Overlay
    overlay = page.locator("text='Executing…'")
    expect(overlay).to_be_visible()

    # Confirm completion
    completed_badge = page.locator("text='Completed'").first
    expect(completed_badge).to_be_visible(timeout=15000)

    # 6. Check that Langfuse traces (or cost) appeared in the UI
    cost_indicator = page.locator("text='$0.00'")
    # Cost should not be strictly $0.0000 if real LLM ran
    expect(cost_indicator).not_to_have_text("$0.0000")
