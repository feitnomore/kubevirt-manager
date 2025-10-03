#!/bin/sh
# Copyright 2025 Marcelo Parisi (github.com/feitnomore)
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#


RESOLUTION="1920,1280"
WAITMS="18000"

cat screenlist.txt | while read thisline
do
    FILE=`echo $thisline | cut -d , -f 1`
    URL=`echo $thisline | cut -d , -f 2`
    /usr/bin/chromium-browser --disable-logging --disable-extensions --disable-audio-input --disable-audio-output --headless=new --window-size=$RESOLUTION --disable-gpu --force-device-scale-factor=0.7 --disable-software-rasterizer --disable-dev-shm-usage --virtual-time-budget=$WAITMS --disabled-extensions --no-sandbox --screenshot=/data/$FILE --hide-scrollbars $URL
done