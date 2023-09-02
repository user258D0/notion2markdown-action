#!/bin/bash

# 读取参数
picbed_config=$1
pic_base_url=$2
if [ -z $2 ]; then
    pic_base_url=""
    echo "Warn 未指定图床基础URL, 可能会重复上传."
fi

# 通过git status获取新增,修改,或未追踪的markdown文件
md_file_list=$(git status -s --porcelain | grep -E "M|A|??" | grep -E "\.md$" | awk '{print $2}')
# 对于每个markdown文件，均执行以下操作
for md_file in ${md_file_list[@]}; do
    ./md2picbed.sh $md_file $picbed_config $pic_base_url
done
