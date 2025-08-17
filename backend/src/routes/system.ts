import express from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import fs from 'fs/promises';

const router = express.Router();
const execAsync = promisify(exec);

// Get system information
router.get('/info', async (req, res) => {
  try {
    const systemInfo = {
      platform: os.platform(),
      arch: os.arch(),
      version: process.env.APP_VERSION || '1.0.0',
      uptime: formatUptime(os.uptime()),
      hostname: os.hostname(),
      cpuUsage: await getCPUUsage(),
      memoryUsage: getMemoryUsage(),
      diskUsage: await getDiskUsage(),
      temperature: await getSystemTemperature(),
      loadAverage: os.loadavg(),
      networkInterfaces: getNetworkInfo()
    };

    res.json(systemInfo);
  } catch (error) {
    console.error('Error getting system info:', error);
    res.status(500).json({ error: 'Failed to get system information' });
  }
});

// Update system
router.post('/update', async (req, res) => {
  try {
    console.log('🔄 [SYSTEM] Update requested');
    
    // Check if we're on a Raspberry Pi or similar system
    const platform = os.platform();
    
    if (platform === 'linux') {
      // For Linux systems (including RPi)
      const { stdout, stderr } = await execAsync('sudo apt update && sudo apt upgrade -y');
      console.log('✅ [SYSTEM] System update completed');
      res.json({ success: true, output: stdout, error: stderr });
    } else {
      // For other platforms, just update npm packages
      const { stdout, stderr } = await execAsync('npm update');
      console.log('✅ [SYSTEM] npm packages updated');
      res.json({ success: true, output: stdout, error: stderr });
    }
  } catch (error) {
    console.error('❌ [SYSTEM] Update failed:', error);
    res.status(500).json({ error: 'System update failed', details: error });
  }
});

// Reboot system (Linux/RPi only)
router.post('/reboot', async (req, res) => {
  try {
    const platform = os.platform();
    
    if (platform === 'linux') {
      console.log('🔄 [SYSTEM] Reboot requested');
      res.json({ success: true, message: 'System reboot initiated' });
      
      // Delay the reboot to allow response to be sent
      setTimeout(async () => {
        try {
          await execAsync('sudo reboot');
        } catch (error) {
          console.error('❌ [SYSTEM] Reboot failed:', error);
        }
      }, 2000);
    } else {
      res.status(400).json({ error: 'Reboot only available on Linux systems' });
    }
  } catch (error) {
    console.error('❌ [SYSTEM] Reboot error:', error);
    res.status(500).json({ error: 'Reboot failed', details: error });
  }
});

// Get system logs
router.get('/logs', async (req, res) => {
  try {
    const logLevel = req.query.level || 'info';
    const lines = parseInt(req.query.lines as string) || 100;
    
    // For Linux systems, try to get systemd logs
    if (os.platform() === 'linux') {
      try {
        const { stdout } = await execAsync(`journalctl -u taptunes --lines=${lines} --no-pager`);
        res.json({ logs: stdout.split('\n') });
      } catch (error) {
        // Fallback to generic system logs
        const { stdout } = await execAsync(`tail -n ${lines} /var/log/syslog`);
        res.json({ logs: stdout.split('\n') });
      }
    } else {
      // For other platforms, return placeholder
      res.json({ logs: ['Log viewing not available on this platform'] });
    }
  } catch (error) {
    console.error('Error getting logs:', error);
    res.status(500).json({ error: 'Failed to get system logs' });
  }
});

// Network configuration endpoints
router.get('/network', async (req, res) => {
  try {
    const networkInfo = {
      interfaces: getNetworkInfo(),
      wifiNetworks: await getAvailableWifiNetworks(),
      currentConnection: await getCurrentWifiConnection()
    };
    
    res.json(networkInfo);
  } catch (error) {
    console.error('Error getting network info:', error);
    res.status(500).json({ error: 'Failed to get network information' });
  }
});

router.post('/network/wifi', async (req, res) => {
  try {
    const { ssid, password } = req.body;
    
    if (!ssid) {
      return res.status(400).json({ error: 'SSID is required' });
    }
    
    // For Linux systems, configure WiFi
    if (os.platform() === 'linux') {
      // This is a simplified example - real implementation would need proper WiFi configuration
      console.log(`🌐 [SYSTEM] Connecting to WiFi: ${ssid}`);
      res.json({ success: true, message: `Connecting to ${ssid}` });
    } else {
      res.status(400).json({ error: 'WiFi configuration only available on Linux systems' });
    }
  } catch (error) {
    console.error('WiFi configuration error:', error);
    res.status(500).json({ error: 'WiFi configuration failed' });
  }
});

// Helper functions
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

async function getCPUUsage(): Promise<number> {
  try {
    if (os.platform() === 'linux') {
      const { stdout } = await execAsync("top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | awk -F'%' '{print $1}'");
      return parseFloat(stdout.trim()) || 0;
    } else {
      // Simplified CPU usage for other platforms
      const cpus = os.cpus();
      let totalIdle = 0;
      let totalTick = 0;
      
      cpus.forEach(cpu => {
        for (const type in cpu.times) {
          totalTick += cpu.times[type as keyof typeof cpu.times];
        }
        totalIdle += cpu.times.idle;
      });
      
      return Math.round(100 - (totalIdle / totalTick) * 100);
    }
  } catch (error) {
    return 0;
  }
}

function getMemoryUsage(): number {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  return Math.round((used / total) * 100);
}

async function getDiskUsage(): Promise<number> {
  try {
    if (os.platform() === 'linux') {
      const { stdout } = await execAsync("df -h / | awk 'NR==2 {print $5}' | sed 's/%//'");
      return parseInt(stdout.trim()) || 0;
    } else {
      // Simplified disk usage for other platforms
      return 45; // Placeholder
    }
  } catch (error) {
    return 0;
  }
}

async function getSystemTemperature(): Promise<number> {
  try {
    if (os.platform() === 'linux') {
      // Try to read CPU temperature (common on RPi)
      try {
        const tempData = await fs.readFile('/sys/class/thermal/thermal_zone0/temp', 'utf8');
        return Math.round(parseInt(tempData.trim()) / 1000);
      } catch {
        // Fallback temperature reading methods
        try {
          const { stdout } = await execAsync("vcgencmd measure_temp | grep -o '[0-9.]*'");
          return Math.round(parseFloat(stdout.trim()));
        } catch {
          return 0;
        }
      }
    } else {
      return 0; // Temperature not available on this platform
    }
  } catch (error) {
    return 0;
  }
}

function getNetworkInfo(): any {
  const interfaces = os.networkInterfaces();
  const result: any = {};
  
  for (const [name, addresses] of Object.entries(interfaces)) {
    if (addresses) {
      result[name] = addresses
        .filter(addr => !addr.internal)
        .map(addr => ({
          address: addr.address,
          family: addr.family,
          mac: addr.mac
        }));
    }
  }
  
  return result;
}

async function getAvailableWifiNetworks(): Promise<string[]> {
  try {
    if (os.platform() === 'linux') {
      const { stdout } = await execAsync("iwlist scan | grep ESSID | awk -F':' '{print $2}' | tr -d '\"' | sort | uniq");
      return stdout.trim().split('\n').filter(ssid => ssid.length > 0);
    }
    return [];
  } catch (error) {
    return [];
  }
}

async function getCurrentWifiConnection(): Promise<string | null> {
  try {
    if (os.platform() === 'linux') {
      const { stdout } = await execAsync("iwgetid -r");
      return stdout.trim() || null;
    }
    return null;
  } catch (error) {
    return null;
  }
}

export default router;