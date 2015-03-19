# -*- mode: ruby -*-
# vi: set ft=ruby :

# define the provisioning script run when the VM is created
$script = <<SCRIPT
echo "Provisioning VM for first use:"
echo "Upping MySQL max packet size"
sudo cp /vagrant/test/my.cnf /etc/mysql/my.cnf
sudo service mysql restart
echo "Creating DB and schema"
mysql -u root -pmonkey -e "create database stats;"
mysql -u root -pmonkey stats < /vagrant/test/schema.sql
echo "Granting permissions to test DB user"
mysql -u root -pmonkey -e "grant all on stats.* to 'localtest'@'%' identified by 'localtest';"
echo "Importing test data set"
mysql -u root -pmonkey stats < /vagrant/test/2014-03.sql
date > /etc/vagrant_provisioned_at
echo "Done!"
SCRIPT

VAGRANTFILE_API_VERSION = "2"
Vagrant.configure(VAGRANTFILE_API_VERSION) do |config|

  # what this box calls itself
  config.vm.hostname = "download-counts"

  # name of the base box
  config.vm.box = "precise64-node-git-mysql"

  # location of the base box if you don't have it already
  config.vm.box_url = "https://dl.dropboxusercontent.com/u/547671/precise64-node-git-mysql.box"

  # Your box will be available to your local machine at this address
  # nobody else will be able to see it
  #config.vm.network :private_network, ip: "192.168.33.10"

  # Create a public network, which generally matches to bridged network.
  # If this is turned on your vagrant box will get a local IP
  # you and anybody else on the local network will be able to see it
  # it will NOT be the 192.* address above
  # config.vm.network :public_network

  # uncomment to forward ports.
  config.vm.network :forwarded_port, guest: 3306, host: 3306
  config.vm.network :forwarded_port, guest: 5000, host: 5000

  # Forward your ssh keys to the box (lets git work inside)
  config.ssh.forward_agent = true

  # Share an additional folder to the guest VM. The first argument is
  # the path on the host to the actual folder. The second argument is
  # the path on the guest to mount the folder. And the optional third
  # argument is a set of non-required options.
  config.vm.synced_folder "../.", "/vagrant_npm"

  # this runs the provisioning script defined above
  config.vm.provision "shell", inline: $script

end
