npm install
rm -rf ./log
rm -rf ./mqtt-server.tar
tar -cvf mqtt-server.tar ./
echo "Ifc654321"
scp /Users/xplusz/workspace/mqtt-server/mqtt-server.tar root@47.116.75.164:/www/wwwroot/fcity/mqtt-server/