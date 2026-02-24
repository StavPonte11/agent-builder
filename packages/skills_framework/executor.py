"""
Standalone Skill Executor
Loads a skill definition and a template, applies the template data to the skill prompt, and executes the LLM.
"""

import json
from typing import Dict, Any, Optional
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage

class SkillExecutor:
    def __init__(self, trace_provider=None):
        """
        :param trace_provider: Optional tracing integration (e.g. Langfuse)
        """
        self.trace_provider = trace_provider

    async def execute(self, skill_prompt: str, parameters: Dict[str, Any], template_data: Dict[str, Any], user_input: str) -> Dict[str, Any]:
        """
        Executes a skill given its prompt and parameters, populating template variables.
        """
        
        system_prompt = skill_prompt
        
        # Replace variables dynamically if present in template_data
        if "fields" in template_data:
            schema_json = json.dumps(template_data["fields"], ensure_ascii=False, indent=2)
            system_prompt = system_prompt.replace("{template_schema}", schema_json)
            
        if "glossary_terms" in template_data:
            glossary_json = json.dumps(template_data["glossary_terms"], ensure_ascii=False, indent=2)
            system_prompt = system_prompt.replace("{glossary}", glossary_json)
            
        if "few_shot_examples" in template_data:
            examples_json = json.dumps(template_data["few_shot_examples"], ensure_ascii=False, indent=2)
            system_prompt = system_prompt.replace("{examples}", examples_json)
            
        if "language" in template_data:
            system_prompt = system_prompt.replace("{language}", template_data["language"])

        model_name = parameters.get("model", "gpt-4o-mini")
        temperature = parameters.get("temperature", 0.1)

        try:
            llm = ChatOpenAI(model=model_name, temperature=temperature)
            response = await llm.ainvoke([
                SystemMessage(content=system_prompt),
                HumanMessage(content=user_input)
            ])
            
            raw_content = response.content.strip()
            
            # Basic JSON extraction if returned in markdown
            if "```json" in raw_content:
                raw_content = raw_content.split("```json")[1].split("```")[0].strip()
            elif "```" in raw_content:
                raw_content = raw_content.split("```")[1].split("```")[0].strip()
                
            try:
                structured_data = json.loads(raw_content)
                return {"success": True, "output": structured_data, "raw": response.content}
            except json.JSONDecodeError:
                return {"success": True, "output": raw_content, "raw": response.content}
                
        except Exception as e:
            return {"success": False, "error": str(e)}

