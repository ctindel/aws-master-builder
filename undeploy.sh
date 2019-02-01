#!/bin/bash

export AWS_DEFAULT_REGION=us-east-2

aws cloudformation delete-stack --stack-name ctindel-mb3
