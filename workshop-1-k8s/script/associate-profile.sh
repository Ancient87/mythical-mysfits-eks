#! /bin/bash

set -eu

if [[ $# -eq 1 ]]; then
  STACK_NAME=$#
else
  STACK_NAME=mysfits-cloud9
fi

sudo yum install -y jq

aws cloudformation describe-stacks --stack-name "$STACK_NAME" | jq -r '[.Stacks[0].Outputs[] | {key: .OutputKey, value: .OutputValue}] | from_entries' > cfn-output.json

instance_id=$(curl -sS http://169.254.169.254/latest/meta-data/instance-id)
profile_name="$(jq < cfn-output.json -r '.ProfileName')"


if aws ec2 associate-iam-instance-profile --iam-instance-profile "Name=$profile_name" --instance-id $instance_id; then
  echo "Profile associated successfully."
  aws cloud9 update-environment --environment-id
else
  echo "WARNING: Encountered error associating instance profile with Cloud9 environment"
fi