from openai import OpenAI
from app.core.config import OPENAI_API_KEY

# Initialize client only when API key is available
client = None
if OPENAI_API_KEY:
    client = OpenAI(api_key=OPENAI_API_KEY)


def get_schema_with_examples() -> str:
    """
    Get the database schema with sample values.
    Improves LLM accuracy by providing concrete examples.
    """
    schema = """
Table: business_small

Columns:
- business_id (VARCHAR) - Unique identifier
- name (VARCHAR) - Business name
- city (VARCHAR) - City name
- state (VARCHAR) - State abbreviation
- stars (FLOAT) - Rating 0-5
- review_count (INTEGER) - Number of reviews
- categories (VARCHAR) - Business categories (comma-separated)

Sample Values:
- Cities: Philadelphia, Phoenix, Tampa, Toronto, Tucson
- States: PA, AZ, FL, ON, AZ
- Categories: Restaurants, Bars, Cafes, Shopping, Automotive
- Stars: 3.5, 4.0, 4.5, 5.0
- Review counts: 10, 50, 100, 500, 1000+
"""
    return schema


def build_system_prompt() -> str:
    """
    Build a structured system prompt for SQL generation.
    Includes role definition, strict rules, and schema injection.
    """
    schema = get_schema_with_examples()
    
    prompt = f"""You are a PostgreSQL expert. Generate a valid SQL query based on the natural language question.

RULES (MANDATORY):
1. ONLY return the SQL query
2. NO explanations, NO markdown, NO code blocks
3. ONLY SELECT queries allowed
4. Do NOT invent columns that don't exist
5. Use exact table name: business_small
6. Add LIMIT 100 if not specified
7. Use ORDER BY for rankings (descending)
8. Use GROUP BY for aggregations
9. Ensure valid PostgreSQL syntax

DATABASE SCHEMA:
{schema}

QUERY GUIDELINES:
- For "top" queries: Use ORDER BY ... DESC LIMIT N
- For "count" queries: Use COUNT(*) with GROUP BY
- For "filtered" queries: Use WHERE clause
- For city/state filters: Use city='...' or state='...'

OUTPUT: Only the SQL query, nothing else."""
    
    return prompt


def clean_sql_output(sql: str) -> str:
    """
    Clean LLM output to ensure valid SQL.
    Removes markdown, trims whitespace, handles edge cases.
    """
    # Remove markdown code blocks
    sql = sql.replace("```sql", "").replace("```", "")
    
    # Remove leading/trailing whitespace and newlines
    sql = sql.strip()
    
    # Remove trailing semicolon if present (will be added by query service)
    sql = sql.rstrip(";")
    
    return sql


def generate_sql(question: str) -> str:
    """
    Generate a SQL query from a natural language question.
    Uses structured prompt with schema injection.
    """
    if not client:
        raise ValueError("OpenAI API key is not configured. Please set OPENAI_API_KEY environment variable.")
    
    system_prompt = build_system_prompt()
    
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": question}
        ],
        temperature=0
    )
    
    sql = response.choices[0].message.content
    sql = clean_sql_output(sql)
    
    return sql
