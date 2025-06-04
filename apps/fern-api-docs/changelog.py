import yaml
import argparse
import datetime
import llm_client


def main(vrn, d):

    print(f"Generating prompt for `{vrn}` API on {d}.")

    p = gen_prompt(f"temp/{vrn}/{d}_oasdiff.md", get_links(vrn), vrn)

    pr_file = f"temp/{vrn}/{d}_prompt.md"
    with open(pr_file, 'w', encoding="utf-8") as outfile:
        outfile.write(p)
        print(f"Wrote prompt to {pr_file}.")

    print('Sending request to LLM.')
    l = llm_client.get_response(p)
    log_file = f"./fern/apis/{vrn}/changelog/{d}.md"
    if (l) and 'Error' not in l.partition('\n')[0]:
        with open(log_file, 'w', encoding="utf-8") as outfile:
            outfile.write(llm_client.get_lines_between_tags(l, 'changelog'))
            print(f"Wrote log to {log_file}.")
    else:
        print(f"Failed to generate {log_file}. No response from LLM.")



def gen_prompt(oasdiff, links, version):
    with open(oasdiff, 'r') as infile:
        oasdiff = infile.read()

    prompt = f"""
Please provide an API changelog for the {version} API from the following OASDiff of OpenAPI spec changes. The output should be in markdown format grouping endpoints by use case/object type. For cases where some schema is modified, please also tell what endpoints it affects. Wherever an endpoint, property, or enum value is mentioned, surround it with backticks (`). Use only H2 and H3 headings. Wherever an API is mentioned, include a hyperlink to the corresponding path from `<api_links>` section. Place the changelog in a `<changelog>` element in your response so I can parse it out.

<oasdiff>
{oasdiff}
</oasdiff>

<api_links>
{links}
</api_links>
"""

    return prompt

def get_links(version):

    src = f"./fern/apis/{version}/openapi-{version}.yaml"

    with open(src, 'r') as s:
        spec = yaml.safe_load(s)
    apis = {}
    for endp, defn in spec['paths'].items():
        for val in defn.values():
            tag = val.get('tags')[0]
            opId = val.get('operationId')
            api = {'opId' : opId, 'method': endp.split('.')[-1]}
            api['target'] = f"/{version}/api-reference/{tag}/{opId.replace(f'{tag}-', '')}"
            if tag not in apis:
                apis[tag] = {endp: api}
            else:
                apis[tag][endp] = api

    md = f"# {version}\n\n"
    for tag, api in sorted(apis.items()):
        md += f"\n## {tag}\n\n"
        for endp, val in api.items():
            link_text = f"**{tag} > {val['method']}**: `{val['opId']}`"
            md += f"- [{endp}]({val['target']}) {link_text}\n"
    return md

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate release notes")
    parser.add_argument('--date', default=datetime.date.today())
    parser.add_argument('--beta', default=True,
                        action=argparse.BooleanOptionalAction)
    parser.add_argument('--public', default=True,
                        action=argparse.BooleanOptionalAction)
    args = parser.parse_args()
    if args.beta:
        main('beta', args.date)
    if args.public:
        main('public', args.date)