#!/usr/bin/env python3

from aws_cdk import (
    core,
    aws_ecr as ecr,
    aws_ssm as ssm,
    aws_iam as iam,
)

import logging
import os

logger = logging.getLogger("ECR")
ch = logging.StreamHandler()
# create formatter and add it to the handlers
formatter = logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
ch.setFormatter(formatter)
# add the handlers to the logger
logger.addHandler(ch)
logger.setLevel(logging.DEBUG)

REGION = "ap-southeast-1"

app = core.App()

prefix = app.node.try_get_context("prefix")

role_arn = app.node.try_get_context("role_arn")

env = core.Environment(region=REGION)

class ECRStack(core.Stack):

    def __init__(
        self,
        scope: core.Construct,
        id: str,
        role_arn: str,
        **kwargs,
    ) -> None:

        super().__init__(scope, id, **kwargs)
        
        role_o = iam.Role.from_role_arn(self, "role", role_arn=role_arn)
        
        ecr_monolith = ecr.Repository(
            self,
            "monolith",
        )
        
        ecr_monolith.grant_pull(role_o)
        
        output_monolith = core.CfnOutput(
            self,
            "om",
            export_name="om",
            value=ecr_monolith.repository_uri
        )
        
        ecr_like = ecr.Repository(
            self,
            "like",
        )
        
        ecr_monolith.grant_pull(role_o)
        ecr_like.grant_pull(role_o)
        
        output_like = core.CfnOutput(
            self,
            "ol",
            export_name="ol",
            value=ecr_like.repository_uri
        )

ECRStack(
    app,
    "ecr",
    env=env,
    role_arn=role_arn,
)

# TGWStack(app, "tgw", env=env_tgw, security_vpc=SECURITY_VPC, spoke_vpcs=SPOKE_VPCS, vpn_eni_a=VPN_ENI_A, vpn_eni_b=VPN_ENI_B)

app.synth()
