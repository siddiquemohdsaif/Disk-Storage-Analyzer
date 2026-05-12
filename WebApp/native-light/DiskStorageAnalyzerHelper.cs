using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Windows.Forms;

namespace DiskStorageAnalyzer
{
    public class HelperForm : Form
    {
        private Label webStatus;
        private Label helperStatus;
        private Label webUrlLabel;
        private Label helperUrlLabel;
        private TextBox logBox;
        private Button openButton;
        private Process helperProcess;
        private Process webProcess;
        private string appDir;
        private string webUrl;
        private string helperUrl;
        private string token;

        [STAThread]
        public static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new HelperForm());
        }

        public HelperForm()
        {
            Text = "Disk Storage Analyzer Helper";
            Width = 460;
            Height = 360;
            MinimumSize = new Size(400, 320);
            BackColor = Color.FromArgb(245, 246, 248);
            Font = new Font("Segoe UI", 9F);

            BuildUi();
            Shown += delegate { StartServices(); };
            FormClosing += delegate { StopServices(); };
        }

        private void BuildUi()
        {
            var title = new Label
            {
                Text = "Disk Storage Analyzer",
                Font = new Font("Segoe UI", 16F, FontStyle.Bold),
                Left = 18,
                Top = 18,
                Width = 380,
                Height = 28
            };

            var subtitle = new Label
            {
                Text = "Local helper for the web app.",
                ForeColor = Color.FromArgb(104, 115, 133),
                Left = 20,
                Top = 50,
                Width = 380,
                Height = 20
            };

            webStatus = CreateStatusCard("Website", 20, 84);
            helperStatus = CreateStatusCard("Disk helper", 230, 84);

            webUrlLabel = CreateInfoLabel("Website", 20, 154);
            helperUrlLabel = CreateInfoLabel("Helper", 20, 204);

            openButton = new Button
            {
                Text = "Open Website",
                Left = 20,
                Top = 252,
                Width = 400,
                Height = 34,
                BackColor = Color.FromArgb(15, 118, 110),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat
            };
            openButton.FlatAppearance.BorderColor = Color.FromArgb(15, 118, 110);
            openButton.Click += delegate { OpenWebsite(); };

            logBox = new TextBox
            {
                Left = 20,
                Top = 296,
                Width = 400,
                Height = 36,
                ReadOnly = true,
                Multiline = true,
                BorderStyle = BorderStyle.FixedSingle,
                ForeColor = Color.FromArgb(104, 115, 133)
            };

            Controls.Add(title);
            Controls.Add(subtitle);
            Controls.Add(webStatus);
            Controls.Add(helperStatus);
            Controls.Add(webUrlLabel);
            Controls.Add(helperUrlLabel);
            Controls.Add(openButton);
            Controls.Add(logBox);
        }

        private Label CreateStatusCard(string caption, int left, int top)
        {
            var label = new Label
            {
                Text = caption + Environment.NewLine + "Starting",
                Left = left,
                Top = top,
                Width = 190,
                Height = 54,
                BorderStyle = BorderStyle.FixedSingle,
                BackColor = Color.White,
                Padding = new Padding(10),
                ForeColor = Color.FromArgb(19, 121, 91)
            };
            return label;
        }

        private Label CreateInfoLabel(string caption, int left, int top)
        {
            return new Label
            {
                Text = caption + ": -",
                Left = left,
                Top = top,
                Width = 400,
                Height = 32,
                ForeColor = Color.FromArgb(23, 32, 42),
                AutoEllipsis = true
            };
        }

        private void StartServices()
        {
            appDir = Path.Combine(Path.GetTempPath(), "DiskStorageAnalyzerWebHelper");
            EmbeddedAssets.WriteTo(appDir);
            int helperPort = FindFreePort(37891);
            int webPort = FindFreePort(5173);
            token = CreateToken();
            helperUrl = "http://127.0.0.1:" + helperPort;
            webUrl = "http://127.0.0.1:" + webPort;

            webUrlLabel.Text = "Website: " + webUrl;
            helperUrlLabel.Text = "Helper: " + helperUrl;

            string allowedOrigins = "http://localhost:" + webPort + ",http://127.0.0.1:" + webPort;

            helperProcess = StartNode(
                Path.Combine(appDir, "helper", "server.cjs"),
                new string[,] {
                    { "DSA_HELPER_PORT", helperPort.ToString() },
                    { "DSA_HELPER_TOKEN", token },
                    { "DSA_ALLOWED_ORIGINS", allowedOrigins }
                });

            webProcess = StartNode(
                Path.Combine(appDir, "scripts", "web-static-server.cjs"),
                new string[,] {
                    { "DSA_WEB_PORT", webPort.ToString() },
                    { "DSA_WEB_DIST_DIR", Path.Combine(appDir, "dist") }
                });

            webStatus.Text = "Website" + Environment.NewLine + "Running";
            helperStatus.Text = "Disk helper" + Environment.NewLine + "Running";
            Log("Services started.");

            ThreadPool.QueueUserWorkItem(delegate
            {
                if (WaitForHttp(webUrl, 25000))
                {
                    BeginInvoke((MethodInvoker)OpenWebsite);
                }
                else
                {
                    BeginInvoke((MethodInvoker)delegate { Log("Website did not become ready."); });
                }
            });
        }

        private Process StartNode(string scriptPath, string[,] environment)
        {
            if (!File.Exists(scriptPath))
            {
                throw new FileNotFoundException("Missing helper file.", scriptPath);
            }

            var info = new ProcessStartInfo
            {
                FileName = "node.exe",
                Arguments = "\"" + scriptPath + "\"",
                WorkingDirectory = appDir,
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true
            };

            for (int i = 0; i < environment.GetLength(0); i++)
            {
                info.EnvironmentVariables[environment[i, 0]] = environment[i, 1];
            }

            var process = new Process { StartInfo = info, EnableRaisingEvents = true };
            process.OutputDataReceived += delegate(object sender, DataReceivedEventArgs args) { if (args.Data != null) Log(args.Data); };
            process.ErrorDataReceived += delegate(object sender, DataReceivedEventArgs args) { if (args.Data != null) Log(args.Data); };
            process.Exited += delegate { Log("Process stopped."); };
            process.Start();
            process.BeginOutputReadLine();
            process.BeginErrorReadLine();
            return process;
        }

        private void OpenWebsite()
        {
            string url = webUrl + "/?helperUrl=" + Uri.EscapeDataString(helperUrl) + "&token=" + Uri.EscapeDataString(token);
            Process.Start(new ProcessStartInfo { FileName = url, UseShellExecute = true });
        }

        private void StopServices()
        {
            StopProcess(helperProcess);
            StopProcess(webProcess);
        }

        private void StopProcess(Process process)
        {
            try
            {
                if (process != null && !process.HasExited) process.Kill();
            }
            catch
            {
            }
        }

        private void Log(string message)
        {
            if (IsDisposed) return;
            if (InvokeRequired)
            {
                BeginInvoke((MethodInvoker)delegate { Log(message); });
                return;
            }
            logBox.Text = message;
        }

        private static bool WaitForHttp(string url, int timeoutMs)
        {
            DateTime deadline = DateTime.UtcNow.AddMilliseconds(timeoutMs);
            while (DateTime.UtcNow < deadline)
            {
                try
                {
                    var request = (HttpWebRequest)WebRequest.Create(url);
                    request.Timeout = 1500;
                    using (var response = (HttpWebResponse)request.GetResponse())
                    {
                        if ((int)response.StatusCode < 500) return true;
                    }
                }
                catch
                {
                    Thread.Sleep(500);
                }
            }
            return false;
        }

        private static int FindFreePort(int preferredPort)
        {
            for (int port = preferredPort; port < preferredPort + 100; port++)
            {
                TcpListener listener = null;
                try
                {
                    listener = new TcpListener(IPAddress.Parse("127.0.0.1"), port);
                    listener.Start();
                    return port;
                }
                catch
                {
                }
                finally
                {
                    if (listener != null) listener.Stop();
                }
            }
            throw new InvalidOperationException("Could not find a free localhost port.");
        }

        private static string CreateToken()
        {
            byte[] bytes = new byte[18];
            using (var rng = RandomNumberGenerator.Create())
            {
                rng.GetBytes(bytes);
            }
            return Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
        }
    }
}
