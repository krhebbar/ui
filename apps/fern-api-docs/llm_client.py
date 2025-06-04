import os
import re
import requests

def get_response(prompt):

    auth = os.environ.get('LLM_TOKEN')
    if auth:
        headers = {"Content-Type": "application/json", "Authorization": f"Bearer {auth}"}
        payload = {
            "model": "us.anthropic.claude-3-5-sonnet-20241022-v2:0",
            "temperature": 0,
            "messages": [
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        }
        try:
            r = requests.post('https://openwebui.dev.devrev-eng.ai/api/chat/completions', json=payload,
                            headers=headers)
            r.raise_for_status()
            print(r)

            if not r.text:
                raise ValueError("Empty response received from API")
            else:
                response = r.json()

            if not response.get('choices'):
                raise ValueError("No 'choices' field in response")
            if not response['choices'][0].get('message'):
                raise ValueError("No 'message' field in response")
            if not response['choices'][0]['message'].get('content'):
                raise ValueError("No 'content' field in response")
            else:
                response = response['choices'][0]['message']['content']
            
            if not response:
                raise ValueError("Empty content received from LLM.")
            else:
                print("Response received from LLM.")
                return response

        except requests.RequestException as e:
            msg = f"HTTP request failed. Error: {type(e)} {e}"
            print(msg)
            return msg
        except ValueError as e:
            msg = f"Invalid response received. Error: {e}"
            print(msg)
            return msg
        except Exception as e:
            msg = f"Failed to generate response. Error: {type(e)} {e}"
            print(msg)
            return msg
        
def get_lines_between_tags(text, tag):
  pattern = r'<' + tag + r'>(.*?)<\/' + tag + r'>'
  matches = re.findall(pattern, text, re.DOTALL)
  return "".join([match.strip() for match in matches])

def get_lines_before_tag(text, tag):
  pattern = r'(.*?)<' + tag + r'>'
  matches = re.findall(pattern, text, re.DOTALL)
  return "".join([match.strip() for match in matches])