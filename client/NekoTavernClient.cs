using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;

[assembly: System.Reflection.AssemblyTitle("猫猫酒馆客户端")]
[assembly: System.Reflection.AssemblyDescription("猫猫酒馆 (Neko Tavern) 本地桌面端与手机 APP 伴侣启动器")]
[assembly: System.Reflection.AssemblyCompany("Neko Tavern")]
[assembly: System.Reflection.AssemblyProduct("猫猫酒馆")]
[assembly: System.Reflection.AssemblyVersion("1.0.0.0")]

namespace NekoTavernClient
{
    internal enum ShellMode
    {
        Desktop,
        Mobile,
        DsClassic
    }

    internal static class Program
    {
        [DllImport("user32.dll")]
        private static extern bool SetProcessDPIAware();

        private const int DefaultPort = 8765;

        [STAThread]
        private static void Main(string[] args)
        {
            try
            {
                SetProcessDPIAware();
            }
            catch
            {
                // Ignore on older OS builds
            }

            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

#if DEFAULT_MOBILE
            ShellMode initialMode = ShellMode.Mobile;
#else
            ShellMode initialMode = ShellMode.Desktop;
#endif
            bool lanRequested = false;

            foreach (string raw in args)
            {
                string arg = (raw ?? string.Empty).Trim().ToLowerInvariant();
                if (arg == "--mobile" || arg == "-m")
                {
                    initialMode = ShellMode.Mobile;
                }
                else if (arg == "--ds")
                {
                    initialMode = ShellMode.DsClassic;
                }
                else if (arg == "--desktop" || arg == "--companion")
                {
                    initialMode = ShellMode.Desktop;
                }
                else if (arg == "--lan")
                {
                    lanRequested = true;
                }
            }

            string rootDir = ResolveProjectRoot();
            if (rootDir == null)
            {
                MessageBox.Show(
                    "未找到猫猫酒馆服务目录（server\\index.mjs）。\n请将客户端放在项目根目录下运行。",
                    "猫猫酒馆客户端",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
                return;
            }

            string distIndex = Path.Combine(rootDir, "dist", "index.html");
            if (!File.Exists(distIndex))
            {
                MessageBox.Show(
                    "尚未检测到前端构建产物（dist\\index.html）。\n请先在项目目录运行一次 pnpm build。",
                    "猫猫酒馆客户端",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Warning
                );
                return;
            }

            bool createdNew;
            using (Mutex trayMutex = new Mutex(true, "Local\\NekoTavernTrayController_" + DefaultPort, out createdNew))
            {
                if (!createdNew)
                {
                    // 已有托盘守护实例运行：确保服务就绪后直接弹出目标模式窗口即可
                    if (WaitForServer(DefaultPort, 3000))
                    {
                        AppLauncher.OpenWindow(rootDir, DefaultPort, initialMode);
                    }
                    else
                    {
                        MessageBox.Show(
                            "猫猫酒馆后台服务正在启动中，请稍候片刻重试。",
                            "猫猫酒馆",
                            MessageBoxButtons.OK,
                            MessageBoxIcon.Information
                        );
                    }
                    return;
                }

                using (TrayAppContext ctx = new TrayAppContext(rootDir, DefaultPort, initialMode, lanRequested))
                {
                    if (ctx.Initialized)
                    {
                        Application.Run(ctx);
                    }
                }
            }
        }

        internal static string ResolveProjectRoot()
        {
            string baseDir = AppDomain.CurrentDomain.BaseDirectory;
            string candidate1 = Path.GetFullPath(baseDir);
            if (File.Exists(Path.Combine(candidate1, "server", "index.mjs")))
            {
                return candidate1;
            }

            DirectoryInfo parent = Directory.GetParent(candidate1.TrimEnd(Path.DirectorySeparatorChar));
            if (parent != null && File.Exists(Path.Combine(parent.FullName, "server", "index.mjs")))
            {
                return parent.FullName;
            }

            return null;
        }

        internal static bool IsServerReady(int port)
        {
            try
            {
                HttpWebRequest req = (HttpWebRequest)WebRequest.Create("http://127.0.0.1:" + port + "/");
                req.Method = "HEAD";
                req.Timeout = 700;
                req.ReadWriteTimeout = 700;
                req.Proxy = null;
                using (HttpWebResponse resp = (HttpWebResponse)req.GetResponse())
                {
                    return (int)resp.StatusCode >= 200 && (int)resp.StatusCode < 400;
                }
            }
            catch
            {
                return false;
            }
        }

        internal static bool WaitForServer(int port, int timeoutMs)
        {
            Stopwatch sw = Stopwatch.StartNew();
            while (sw.ElapsedMilliseconds < timeoutMs)
            {
                if (IsServerReady(port))
                {
                    return true;
                }
                Thread.Sleep(180);
            }
            return IsServerReady(port);
        }
    }

    internal static class AppLauncher
    {
        public static string FindNodeExecutable()
        {
            string envPath = Environment.GetEnvironmentVariable("PATH") ?? string.Empty;
            foreach (string rawDir in envPath.Split(Path.PathSeparator))
            {
                if (string.IsNullOrWhiteSpace(rawDir))
                {
                    continue;
                }
                try
                {
                    string candidate = Path.Combine(rawDir.Trim(), "node.exe");
                    if (File.Exists(candidate))
                    {
                        return candidate;
                    }
                }
                catch
                {
                    // Ignore malformed PATH entries
                }
            }

            string[] fallbacks = new string[]
            {
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "nodejs", "node.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "nodejs", "node.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "nodejs", "node.exe")
            };

            foreach (string path in fallbacks)
            {
                if (File.Exists(path))
                {
                    return path;
                }
            }
            return null;
        }

        public static string FindChromiumBrowser()
        {
            string[] candidates = new string[]
            {
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Microsoft", "Edge", "Application", "msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Microsoft", "Edge", "Application", "msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Microsoft", "Edge", "Application", "msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Google", "Chrome", "Application", "chrome.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Google", "Chrome", "Application", "chrome.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Google", "Chrome", "Application", "chrome.exe")
            };

            foreach (string c in candidates)
            {
                if (File.Exists(c))
                {
                    return c;
                }
            }
            return null;
        }

        public static void OpenWindow(string rootDir, int port, ShellMode mode)
        {
            string url;
            string profileName;
            int width;
            int height;

            if (mode == ShellMode.Mobile)
            {
                url = "http://127.0.0.1:" + port + "/?mode=mobile";
                profileName = "ui-mobile-app";
                width = 430;
                height = 880;
            }
            else if (mode == ShellMode.DsClassic)
            {
                url = "http://127.0.0.1:" + port + "/?mode=ds";
                profileName = "ui-desktop-main";
                width = 1280;
                height = 850;
            }
            else
            {
                url = "http://127.0.0.1:" + port + "/?mode=companion";
                profileName = "ui-desktop-main";
                width = 1340;
                height = 880;
            }

            string browser = FindChromiumBrowser();
            if (browser == null)
            {
                Process.Start(new ProcessStartInfo
                {
                    FileName = url,
                    UseShellExecute = true
                });
                return;
            }

            string profileDir = Path.Combine(rootDir, ".data", profileName);
            Directory.CreateDirectory(profileDir);

            Rectangle screen = Screen.PrimaryScreen != null
                ? Screen.PrimaryScreen.WorkingArea
                : new Rectangle(0, 0, 1920, 1080);

            int winW = Math.Min(width, Math.Max(390, screen.Width - 24));
            int winH = Math.Min(height, Math.Max(660, screen.Height - 24));
            int posX = screen.Left + Math.Max(12, (screen.Width - winW) / 2);
            int posY = screen.Top + Math.Max(12, (screen.Height - winH) / 2);

            string arguments = string.Format(
                "--app=\"{0}\" --user-data-dir=\"{1}\" --window-size={2},{3} --window-position={4},{5} --no-first-run --no-default-browser-check --disable-features=Translate",
                url,
                profileDir,
                winW,
                winH,
                posX,
                posY
            );

            Process.Start(new ProcessStartInfo
            {
                FileName = browser,
                Arguments = arguments,
                UseShellExecute = false
            });
        }

        public static List<string> GetLanIpv4List()
        {
            List<string> list = new List<string>();
            try
            {
                foreach (NetworkInterface ni in NetworkInterface.GetAllNetworkInterfaces())
                {
                    if (ni.OperationalStatus != OperationalStatus.Up ||
                        ni.NetworkInterfaceType == NetworkInterfaceType.Loopback)
                    {
                        continue;
                    }
                    foreach (UnicastIPAddressInformation ip in ni.GetIPProperties().UnicastAddresses)
                    {
                        if (ip.Address.AddressFamily == AddressFamily.InterNetwork)
                        {
                            string addr = ip.Address.ToString();
                            if (addr.StartsWith("192.168.") || addr.StartsWith("10.") || addr.StartsWith("172."))
                            {
                                if (!list.Contains(addr))
                                {
                                    list.Add(addr);
                                }
                            }
                        }
                    }
                }
            }
            catch
            {
                // Ignore network enum errors
            }
            return list;
        }
    }

    internal sealed class TrayAppContext : ApplicationContext
    {
        private readonly string _rootDir;
        private readonly int _port;
        private NotifyIcon _tray;
        private Process _serverProcess;
        private bool _lanEnabled;
        private ToolStripMenuItem _lanItem;

        public bool Initialized { get; private set; }

        public TrayAppContext(string rootDir, int port, ShellMode initialMode, bool startLan)
        {
            _rootDir = rootDir;
            _port = port;
            _lanEnabled = startLan;

            if (!EnsureServerStarted(_lanEnabled))
            {
                return;
            }

            BuildTrayIcon(initialMode);
            AppLauncher.OpenWindow(_rootDir, _port, initialMode);

            _tray.ShowBalloonTip(
                2800,
                "猫猫酒馆已就绪",
                initialMode == ShellMode.Mobile
                    ? "手机 APP 陪伴小窗已启动。右键系统托盘猫咪图标可随时切换宽屏版或退出。"
                    : "桌面客户端已启动。右键系统托盘猫咪图标可打开手机 APP 小窗、连接真机或退出。",
                ToolTipIcon.None
            );

            Initialized = true;
        }

        private bool EnsureServerStarted(bool lan)
        {
            if (Program.IsServerReady(_port))
            {
                return true;
            }

            string nodeExe = AppLauncher.FindNodeExecutable();
            if (nodeExe == null)
            {
                MessageBox.Show(
                    "未在系统中检测到 Node.js (node.exe)。\n请安装 Node.js 22+ 后再启动猫猫酒馆客户端。",
                    "猫猫酒馆客户端",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
                return false;
            }

            string scriptPath = Path.Combine(_rootDir, "server", "index.mjs");
            string args = "\"" + scriptPath + "\"" + (lan ? " --lan" : string.Empty);

            ProcessStartInfo psi = new ProcessStartInfo
            {
                FileName = nodeExe,
                Arguments = args,
                WorkingDirectory = _rootDir,
                CreateNoWindow = true,
                UseShellExecute = false,
                WindowStyle = ProcessWindowStyle.Hidden
            };

            try
            {
                _serverProcess = Process.Start(psi);
            }
            catch (Exception ex)
            {
                MessageBox.Show(
                    "启动本地后台服务失败：\n" + ex.Message,
                    "猫猫酒馆客户端",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
                return false;
            }

            if (!Program.WaitForServer(_port, 12000))
            {
                StopManagedServer();
                MessageBox.Show(
                    "等待本地服务响应超时（端口 " + _port + "）。请检查端口是否被其他程序占用。",
                    "猫猫酒馆客户端",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
                return false;
            }

            return true;
        }

        private void BuildTrayIcon(ShellMode defaultMode)
        {
            Icon appIcon = null;
            try
            {
                appIcon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
            }
            catch
            {
                // Fallback below
            }

            ContextMenuStrip menu = new ContextMenuStrip();
            menu.Font = new Font("Microsoft YaHei UI", 9.25f);

            ToolStripMenuItem openDesktop = new ToolStripMenuItem("✦ 打开猫猫酒馆（桌面宽屏版）");
            openDesktop.Font = new Font(menu.Font, FontStyle.Bold);
            openDesktop.Click += (s, e) => AppLauncher.OpenWindow(_rootDir, _port, ShellMode.Desktop);

            ToolStripMenuItem openMobile = new ToolStripMenuItem("📱 打开手机 APP 陪伴小窗");
            openMobile.Click += (s, e) => AppLauncher.OpenWindow(_rootDir, _port, ShellMode.Mobile);

            ToolStripMenuItem openDs = new ToolStripMenuItem("📘 打开 DeepSeek 经典原版界面");
            openDs.Click += (s, e) => AppLauncher.OpenWindow(_rootDir, _port, ShellMode.DsClassic);

            _lanItem = new ToolStripMenuItem("🌐 开启局域网手机真机连接");
            _lanItem.Checked = _lanEnabled;
            _lanItem.Click += OnToggleLan;

            ToolStripMenuItem openData = new ToolStripMenuItem("📂 打开本地存档目录 (.data)");
            openData.Click += (s, e) =>
            {
                string dataDir = Path.Combine(_rootDir, ".data");
                Directory.CreateDirectory(dataDir);
                Process.Start(new ProcessStartInfo
                {
                    FileName = dataDir,
                    UseShellExecute = true
                });
            };

            ToolStripMenuItem exitItem = new ToolStripMenuItem("✕ 退出猫猫酒馆");
            exitItem.Click += (s, e) => ExitThread();

            menu.Items.Add(openDesktop);
            menu.Items.Add(openMobile);
            menu.Items.Add(openDs);
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add(_lanItem);
            menu.Items.Add(openData);
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add(exitItem);

            _tray = new NotifyIcon
            {
                Icon = appIcon ?? SystemIcons.Application,
                Text = "猫猫酒馆 · 本地私密陪伴客户端",
                ContextMenuStrip = menu,
                Visible = true
            };

            _tray.DoubleClick += (s, e) => AppLauncher.OpenWindow(_rootDir, _port, defaultMode);
        }

        private void OnToggleLan(object sender, EventArgs e)
        {
            if (_serverProcess == null && Program.IsServerReady(_port))
            {
                List<string> ips = AppLauncher.GetLanIpv4List();
                string tip = ips.Count > 0
                    ? "http://" + ips[0] + ":" + _port + "/?mode=mobile"
                    : "http://<电脑局域网IP>:" + _port + "/?mode=mobile";
                MessageBox.Show(
                    "检测到当前后台服务由外部命令行（如 pnpm start）启动。\n\n如需局域网真机手机访问，请先关闭外部终端后再通过客户端开启，或运行：\nnode server/index.mjs --lan\n\n本机局域网参考地址：\n" + tip,
                    "猫猫酒馆 · 局域网真机连接",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Information
                );
                return;
            }

            bool targetLan = !_lanEnabled;
            StopManagedServer();
            Thread.Sleep(250);

            if (EnsureServerStarted(targetLan))
            {
                _lanEnabled = targetLan;
                _lanItem.Checked = _lanEnabled;

                if (_lanEnabled)
                {
                    List<string> ips = AppLauncher.GetLanIpv4List();
                    if (ips.Count > 0)
                    {
                        string mobileUrl = "http://" + ips[0] + ":" + _port + "/?mode=mobile";
                        try
                        {
                            Clipboard.SetText(mobileUrl);
                        }
                        catch
                        {
                            // Ignore clipboard lock
                        }
                        MessageBox.Show(
                            "局域网真机手机连接已开启！\n\n请确保手机与电脑连接同一 Wi-Fi，在手机浏览器打开（已自动复制到剪贴板）：\n\n" +
                            mobileUrl +
                            "\n\n提示：在手机浏览器菜单点击「添加到主屏幕 / 安装应用」，即可获得全屏原生猫猫酒馆 APP 体验！",
                            "猫猫酒馆 · 手机真机连接",
                            MessageBoxButtons.OK,
                            MessageBoxIcon.Information
                        );
                    }
                    else
                    {
                        MessageBox.Show(
                            "局域网监听已开启（0.0.0.0:" + _port + "），但未检测到活动的局域网 IPv4 地址，请检查 Wi-Fi 连接。",
                            "猫猫酒馆 · 手机真机连接",
                            MessageBoxButtons.OK,
                            MessageBoxIcon.Information
                        );
                    }
                }
                else
                {
                    _tray.ShowBalloonTip(2000, "猫猫酒馆", "已切回仅本机私密访问模式（127.0.0.1）。", ToolTipIcon.Info);
                }
            }
        }

        private void StopManagedServer()
        {
            if (_serverProcess != null)
            {
                try
                {
                    if (!_serverProcess.HasExited)
                    {
                        _serverProcess.Kill();
                        _serverProcess.WaitForExit(2000);
                    }
                }
                catch
                {
                    // Ignore if already exited
                }
                finally
                {
                    _serverProcess.Dispose();
                    _serverProcess = null;
                }
            }
        }

        protected override void ExitThreadCore()
        {
            if (_tray != null)
            {
                _tray.Visible = false;
                _tray.Dispose();
                _tray = null;
            }
            StopManagedServer();
            base.ExitThreadCore();
        }
    }
}
