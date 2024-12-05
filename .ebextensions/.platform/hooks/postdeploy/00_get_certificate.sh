#!/usr/bin/env bash
# Place in .platform/hooks/postdeploy directory
sudo certbot -n -d http://theturtleproject.us-east-1.elasticbeanstalk.com/ --nginx --agree-tos --email gabbolm@icloud.com
sudo certbot --nginx --redirect