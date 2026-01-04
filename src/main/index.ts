import { app, BrowserWindow, ipcMain, Menu, dialog, shell } from 'electron'
import { join, dirname } from 'path'
import { spawn, ChildProcess } from 'child_process'
import { writeFileSync } from 'fs'
import Store from 'electron-store'

const store = new Store()
let mainWindow: BrowserWindow | null = null
let pythonProcess: ChildProcess | null = null
let forceQuit = false

// Windows 下隐藏控制台窗口的常量
const CREATE_NO_WINDOW = 0x08000000

function createWindow() {
  // 隐藏菜单栏
  Menu.setApplicationMenu(null)

  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    icon: join(__dirname, '../../public/icon.ico')
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // 拦截关闭事件，显示确认对话框
  mainWindow.on('close', (e) => {
    if (!forceQuit) {
      e.preventDefault()
      mainWindow?.webContents.send('before-close')
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  createWindow()
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  stopPythonServer()
  if (process.platform !== 'darwin') app.quit()
})

// IPC handlers
ipcMain.handle('get-config', () => {
  return store.get('config', {
    model: 'small',
    port: '8000',
    convertNum: true,
    autoStart: false,
    autoRun: false
  })
})

ipcMain.handle('save-config', (_, config) => {
  store.set('config', config)
  return true
})

ipcMain.handle('start-server', async (_, config) => {
  return startPythonServer(config)
})

ipcMain.handle('stop-server', async () => {
  return stopPythonServer()
})

ipcMain.handle('get-server-status', () => {
  return pythonProcess !== null && !pythonProcess.killed
})

// 确认关闭
ipcMain.on('confirm-close', () => {
  forceQuit = true
  stopPythonServer()
  mainWindow?.close()
})

// 保存日志
ipcMain.handle('save-logs', async (_, content: string) => {
  try {
    const result = await dialog.showSaveDialog(mainWindow!, {
      title: '保存日志',
      defaultPath: `whisper_log_${new Date().toISOString().slice(0, 10)}.txt`,
      filters: [
        { name: '文本文件', extensions: ['txt'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    })
    
    if (result.canceled || !result.filePath) {
      return { success: false, cancelled: true }
    }
    
    writeFileSync(result.filePath, content, 'utf-8')
    // 保存后打开文件
    shell.openPath(result.filePath)
    return { success: true, path: result.filePath }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

// 打开日志目录
ipcMain.handle('open-log-folder', async (_, filePath: string) => {
  try {
    shell.showItemInFolder(filePath)
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

function getPythonPath(): string {
  // 开发环境使用系统 Python，生产环境使用打包的 Python
  if (process.env.VITE_DEV_SERVER_URL) {
    return 'python'
  }
  return join(process.resourcesPath, 'python', 'python.exe')
}

function getScriptPath(): string {
  if (process.env.VITE_DEV_SERVER_URL) {
    return join(__dirname, '../../python/server.py')
  }
  return join(process.resourcesPath, 'python', 'server.py')
}

function startPythonServer(config: any): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    if (pythonProcess && !pythonProcess.killed) {
      resolve({ success: false, error: '服务已在运行' })
      return
    }

    const pythonPath = getPythonPath()
    const scriptPath = getScriptPath()
    
    const args = [
      '-u',  // unbuffered output
      scriptPath,
      '--model', config.model,
      '--port', config.port.toString()
    ]
    
    if (config.convertNum) args.push('--convert-num')

    try {
      // 使用 spawn 配合 windowsHide 和特殊的 spawn 选项
      pythonProcess = spawn(pythonPath, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUNBUFFERED: '1' },
        windowsHide: true,
        // @ts-ignore - Windows specific option
        creationFlags: process.platform === 'win32' ? CREATE_NO_WINDOW : undefined
      } as any)

      pythonProcess.stdout?.on('data', (data) => {
        const msg = data.toString()
        mainWindow?.webContents.send('server-log', msg)
      })

      pythonProcess.stderr?.on('data', (data) => {
        const msg = data.toString()
        mainWindow?.webContents.send('server-log', msg)
      })

      pythonProcess.on('error', (err) => {
        mainWindow?.webContents.send('server-status', { running: false, error: err.message })
        pythonProcess = null
      })

      pythonProcess.on('exit', (code) => {
        mainWindow?.webContents.send('server-status', { running: false, code })
        pythonProcess = null
      })

      // 等待一小段时间确认启动成功
      setTimeout(() => {
        if (pythonProcess && !pythonProcess.killed) {
          mainWindow?.webContents.send('server-status', { running: true })
          resolve({ success: true })
        } else {
          resolve({ success: false, error: '启动失败' })
        }
      }, 2000)

    } catch (err: any) {
      resolve({ success: false, error: err.message })
    }
  })
}

function stopPythonServer(): { success: boolean } {
  if (pythonProcess && !pythonProcess.killed) {
    pythonProcess.kill()
    pythonProcess = null
    mainWindow?.webContents.send('server-status', { running: false })
  }
  return { success: true }
}
