#!/bin/bash

# 检查参数是否小于3个
if [ $# -lt 2 ]; then
    echo "使用方法: $0 <Markdown文件路径> <picBed JSON Config> <图床URL>"
    exit 1
fi

# 检查picgo-cli是否安装, 如果没有安装则使用npm安装
if ! command -v picgo &>/dev/null; then
    echo "picgo-cli未安装, 正在安装..."
    npm install -g picgo
fi
# 检查curl和wget是否安装, 如果没有安装则使用apt安装
if ! command -v curl &>/dev/null; then
    echo "curl未安装, 正在安装..."
    sudo apt install curl
fi
# 检查convert是否安装, 如果没有安装则使用apt安装
if ! command -v convert &>/dev/null; then
    echo "imagemagick未安装, 正在安装..."
    sudo apt install imagemagick
fi

# 设置文件和目录的变量
md_file=$1
picbed_config=$2
pic_base_url=$3
if [-z $3]; then
    pic_base_url=""
fi

temp_dir=$(mktemp -d)

# 检查$1是否是MD文件
if [[ $md_file != *.md ]]; then
    echo "文件 $md_file 不是Markdown文件"
    exit 1
fi

# 检查$2是否是JSON字符串
if [[ $picbed_config != \{* ]]; then
    echo "picBed配置不是JSON字符串"
    exit 1
fi

# 检查pic_base_url是否以/结尾
if [ -z $pic_base_url ] && ["${pic_base_url: -1}" != "/"]; then
    pic_base_url+="/"
fi

# 将picgo的配置文件写入到~/.picgo/config.json
echo "正在配置picgo..."
if [ ! -d ~/.picgo ]; then
    mkdir ~/.picgo
fi
if [ -f ~/.picgo/config.json ]; then
    rm ~/.picgo/config.json
fi
echo "{\"picBed\": $picbed_config}" >~/.picgo/config.json

# 检查$temp_dir是否是目录
if [ ! -d $temp_dir ]; then
    echo "目录 $temp_dir 不存在"
    # 创建目录
    mkdir -p $temp_dir
fi

echo "正在查找图片..."

# 撰写一个函数，用于获取图片后缀，参数为图片路径，返回值为图片后缀
ext() {
    # 获取图片后缀，并转为小写
    echo $(identify -format "%m" $1 | tr '[:upper:]' '[:lower:]')
}

# 撰写一个函数，用于获取图片的hash值名称，参数为图片路径，返回值为图片hash值名称
hashname() {
    # 获取图片的hash值
    hash=$(sha256sum $1 | awk '{print $1}')
    # 获取图片后缀
    ext=$(ext $1)
    # 拼接图片hash值名称
    echo $hash.$ext
}

# 撰写一个函数，用于从markdown文件中提取图片链接, 参数为markdown文件路径，返回值为本地图片链接和网络图片链接
getURLfromMD() {
    filename=$1
    # 排除的图片链接的domain
    excude_domain=$2
    # 查找所有图片链接，包括网络图片和本地图片
    ## 正则提取markdown中的本地图片链接，并根据文件相当路径找到其位置
    pattern_local='!\[.*?\]\(((?!http|ftp|mailto|data:)[^\)]+)\)'
    pattern_internet='!\[.*?\]\((https?:\/\/.*?)\)'
    # 匹配notion平台的临时图片链接
    pattern_notion='(https://.*?/secure\.notion-static\.com\/.+\.(?:jpg|jpeg|png|gif|webp)\?.+)'
    # 根据各个pattern提取图片链接
    # local_image_urls=($(grep -oP $pattern_local $filename | sed -E 's/'$pattern_local'/\1/'))
    local_image_urls=($(grep -oP $pattern_local $filename | sed -E 's/.*\((.*)\).*/\1/'))
    internet_image_urls=($(grep -oP $pattern_internet $filename | sed -E 's/.*\((.*)\).*/\1/'))
    notion_image_urls=($(grep -oP $pattern_notion $filename))
    # 合并网络图片链接
    internet_image_urls=(${internet_image_urls[@]} ${notion_image_urls[@]})
    # 去除重复的网络图片链接
    internet_image_urls=($(echo "${internet_image_urls[@]}" | tr ' ' '\n' | awk '!x[$0]++' | tr '\n' ' '))
    # 去除排除的图片链接
    if [ -n "$excude_pattern" ]; then
        internet_image_urls=($(printf "%s\n" "${internet_image_urls[@]}" | grep -vP $excude_domain))
        # internet_image_urls=($(echo "${internet_image_urls[@]}" | tr ' ' '\n' | grep -vP $excude_domain | tr '\n' ' '))
    fi
    # 合并本地图片链接和网络图片链接的数组，并返回
    echo ${local_image_urls[@]} ${internet_image_urls[@]}
}

# 撰写一个函数，用于将网络图片下载到本地，参数为网络图片链接，返回值为本地图片路径
downloadImage() {
    # 获取图片链接
    image_url=$1
    # 获取保存图片的目录，如果目录不存在则创建
    tdir=$2
    if [ ! -d $tdir ]; then
        mkdir -p $tdir
    fi
    # 创建一个临时文件，用于保存图片
    temp_file=$(mktemp)
    # 用wget下载图片到临时目录，带上伪装的user-agent，根据下载得到的文件，自动检测图片类型，将图片重命名为md5值
    if wget -U "Mozilla/5.0 (X11; Linux x86_64; rv:84.0) Gecko/20100101 Firefox/84.0" -O $temp_file "$image_url" &>/dev/null; then
        # 使用identify命令获取图片的类型, 并将其重命名为md5值
        image_name=$(hashname $temp_file)
        image_path=$tdir/$image_name
        mv $temp_file $image_path
        # echo "下载图片 $image_path 成功"
        echo $image_path
    else
        # echo "下载图片 $image_url 失败"
        echo ""
    fi
}

# 撰写一个函数，用于图片进行压缩，参数为图片路径，返回值为压缩后的图片路径
compressImage() {
    # 获取图片路径
    image_path=$1
    # 获取图片类型
    image_type=$(ext $image_path)
    # 获取图片大小, 单位为字节, 转为int类型
    image_size=$(stat -c "%s" "$image_path")
    # 根据图片buffer大小进行压缩，图片越大，压缩比越大
    ratio=0.7
    # 如果图片大小大于10M
    if [ $image_size -gt 10000000 ]; then
        ratio=0.3
    # 如果图片大小大于5M
    elif [ $image_size -gt 5000000 ]; then
        ratio=0.5
    # 如果图片大小大于1M
    elif [ $image_size -gt 1000000 ]; then
        ratio=0.7
    # 如果图片大小大于500K
    elif [ $image_size -gt 500000 ]; then
        ratio=0.8
    fi
    # 创建一个临时文件，用于保存压缩后的图片
    temp_file=$(mktemp)
    # 使用convert命令进行图片压缩
    convert $image_path -quality $ratio $temp_file
    # 根据文件buffer计算md5值
    compressed_image_name=$(hashname $temp_file)
    # 重命名临时文件为压缩后的图片路径
    compressed_image_path=$(dirname $temp_file)/$compressed_image_name
    # 改名
    mv $temp_file $compressed_image_path
    # echo "压缩图片 $image_path 成功"
    echo $compressed_image_path
}

# 撰写一个函数，用于请求图床URL，判断图片是否已经存在
isExistOnPicbed() {
    # 拼接URL, 使用curl发送HEAD请求，判断文件是否存在
    url=$1
    response=$(curl -Is "$url" | head -1)
    if [[ "$response" == *"200 OK"* ]]; then
        echo "$url"
    else
        echo ""
    fi
}

# 撰写一个函数，用于将本地图片上传到图床，参数为本地图片路径，返回值为网络图片链接
upload2picbed() {
    # 获取图片路径
    image_path=$1
    # 使用picgo进行图片上传
    output=$(picgo upload $image_path)
    # 判断output中是否包含failed或error，如果包含，则上传失败，否则上传成功
    if echo $output | grep -qi "failed\|error"; then
        echo ""
    else
        image_url=$(echo $output | grep -oP '(http|https)://.*')
        echo $image_url
    fi
}

excude_pattern=$(echo "$pic_base_url" | sed -e 's/.*\/\/\([^\/]*\).*/\1/')

if [ -z $pic_base_url]; then
    excude_pattern=""
fi

# 调用函数，获取本地图片链接和网络图片链接
all_image_urls=($(getURLfromMD $md_file $excude_pattern))
# all_image_urls=$(getURLfromMD $md_file $excude_pattern)

# 输出去重后的图片链接
echo "找到 ${#all_image_urls[@]} 张图片"

# 打印所有匹配到的图片链接
echo "${all_image_urls[@]}"

# 记录上传成功的图片链接
img_upload_successed=()

# 对于本地图片，直接开始压缩，返回压缩后的图片路径，上传到图床，返回网络图片链接，替换md文件中的图片链接
# 对于网络图片，下载到本地，返回本地图片路径，开始压缩，返回压缩后的图片路径，上传到图床，返回网络图片链接，替换md文件中的图片链接
# 遍历所有图片链接

for image_url in ${all_image_urls[@]}; do
    # 判断图片是否为本地图片，如果是本地图片，则直接压缩，否则先下载到本地
    if echo $image_url | grep -qi "http"; then
        # 下载图片到临时目录
        image_path=($(downloadImage $image_url $temp_dir))
        # 判断图片是否下载成功，如果下载成功，则继续压缩，否则跳过
        if [ -z "$image_path" ]; then
            echo "下载图片 $image_url 失败, 跳过"
            continue
        fi
        echo "下载图片 $image_url 成功"
    else
        echo "图片 $image_url 为本地图片"
        image_path=$(realpath "$(dirname "$(realpath "$md_file")")/$image_url")
    fi
    # 判断是否在图床存在
    hashname = $(hashname $image_path)
    url=$(isExistOnPicbed $pic_base_url$hashname)
    if [ -n "$url" ]; then
        echo "图片已在图床，可直接替换"
        sed -i "s#$image_url#$url#g" $md_file
        img_upload_successed+=($url)
        continue
    fi
    compressed_image_path=""
    # 跳过不需要压缩的图片类型
    if $(ext $image_path | grep -qi "gif\|svg"); then
        echo "图片 $image_url 为不需要压缩的图片类型"
        compressed_image_path=$image_path
    else
        # 开始压缩图片
        compressed_image_path=$(compressImage $image_path)
        if [ -z "$compressed_image_path" ]; then
            echo "压缩图片 $image_path 失败, 跳过"
            continue
        else
            echo "压缩图片 $image_path 成功 -> $compressed_image_path"
        fi
    fi
    # 上传图片到图床
    url=($(upload2picbed $compressed_image_path))
    # 判断图片是否上传成功，如果上传成功，则替换md文件中的图片链接，否则不替换
    if [ -n "$url" ]; then
        # 替换md文件中的图片链接
        sed -i "s#$image_url#$url#g" $md_file
        echo "上传图片 $image_url 成功"
        # 将上传成功的图片链接添加到数组中
        img_upload_successed+=($url)
    else
        echo "上传图片 $image_url 失败, 跳过"
    fi
done

# 删除临时目录
rm -rf $temp_dir
# 提示上传结束，统计上传成功的图片的数量/总的图片的数量，生成统计信息
echo "MD文件 $md_file 中的图片上传结束"
echo "成功上传的URL: $img_upload_successed"
echo "上传完成，上传成功${#img_upload_successed[@]}/${#all_image_urls[@]}张图片"
