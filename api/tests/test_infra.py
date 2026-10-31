"""Guard the privilege boundary and AWS policy size limits before provisioning."""

import json
from pathlib import Path

INFRA = Path(__file__).resolve().parents[2] / "infra"


def test_managed_policies_fit_aws_limit_and_role_creation_requires_boundary():
    statements = []
    for path in INFRA.glob("aws-*.json"):
        policy = json.loads(path.read_text())
        assert len(json.dumps(policy, separators=(",", ":"))) <= 6144, path.name
        statements.extend(policy["Statement"])
    creators = [s for s in statements if "iam:CreateRole" in s["Action"]]
    assert creators
    for statement in creators:
        assert statement["Condition"]["StringEquals"][
            "iam:PermissionsBoundary"
        ].endswith(":policy/RiverbankHackathonRoleBoundary")


def test_role_boundary_cannot_modify_iam_or_send_commands_to_other_hosts():
    boundary = json.loads((INFRA / "aws-role-boundary.json").read_text())
    for statement in boundary["Statement"]:
        actions = statement["Action"]
        if isinstance(actions, str):
            actions = [actions]
        assert not any(action.startswith("iam:") for action in actions)
        if "ssm:SendCommand" in actions:
            assert set(statement["Resource"]) == {
                "arn:aws:ec2:ap-southeast-1:424016506356:instance/i-06ab8a545deb7a7f3",
                "arn:aws:ssm:ap-southeast-1:424016506356:document/riverbank-hackathon-deploy",
            }
