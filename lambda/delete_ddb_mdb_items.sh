#!/bin/bash

export HASH_KEY="oid__id"

declare -a tables=("product" "review" "order")

for table in "${tables[@]}"
do
    aws dynamodb scan \
      --attributes-to-get $HASH_KEY \
      --table-name $table --query "Items[*]" \
      | jq --compact-output '.[]' \
      | tr '\n' '\0' \
      | xargs -0 -t -I keyItem \
        aws dynamodb delete-item --table-name $table --key=keyItem
done
