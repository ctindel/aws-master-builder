#!/bin/bash

export MDB_HASH_KEY="oid__id"
export DDB_HASH_KEY="oid__id"

declare -a MDB_TABLES=(
    "product" 
    "review" 
    "order" 
)

declare -a DDB_TABLES=(
    "ctindel-mb3-product" 
    "ctindel-mb3-review" 
    "ctindel-mb3-order"
)

for table in "${MDB_TABLES[@]}"
do
    aws dynamodb scan \
      --attributes-to-get $MDB_HASH_KEY \
      --table-name $table --query "Items[*]" \
      | jq --compact-output '.[]' \
      | tr '\n' '\0' \
      | xargs -0 -t -I keyItem \
        aws dynamodb delete-item --table-name $table --key=keyItem
done

for table in "${DDB_TABLES[@]}"
do
    aws dynamodb scan \
      --attributes-to-get $DDB_HASH_KEY \
      --table-name $table --query "Items[*]" \
      | jq --compact-output '.[]' \
      | tr '\n' '\0' \
      | xargs -0 -t -I keyItem \
        aws dynamodb delete-item --table-name $table --key=keyItem
done
