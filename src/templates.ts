export const INSTALL_SH_TEMPLATE = `#!/bin/bash

set -e

RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
BLUE='\\033[0;34m'
NC='\\033[0m'

log_info() { echo -e "\${BLUE}[INFO]\${NC} $1"; }
log_success() { echo -e "\${GREEN}[OK]\${NC} $1"; }
log_warn() { echo -e "\${YELLOW}[WARN]\${NC} $1"; }
log_error() { echo -e "\${RED}[ERROR]\${NC} $1"; }

detect_os() {
    case "$(uname -s)" in
        Darwin*) echo "macos" ;;
        Linux*)
            if [ -f /etc/arch-release ]; then
                echo "arch"
            elif [ -f /etc/debian_version ]; then
                echo "debian"
            else
                echo "linux"
            fi
            ;;
        *) log_error "Unsupported OS"; exit 1 ;;
    esac
}

check_command() {
    command -v "$1" &> /dev/null
}

install_system_packages() {
    local os="$1"
    log_info "Installing system packages..."
    
    case "$os" in
        macos)
            if ! check_command brew; then
                log_info "Installing Homebrew..."
                /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
            fi
            brew install git neovim curl unzip ca-certificates gcc
            ;;
        arch)
            if check_command yay; then
                yay -S --needed --noconfirm git neovim curl unzip base-devel tree-sitter
            else
                sudo pacman -S --needed --noconfirm git neovim curl unzip base-devel tree-sitter
            fi
            ;;
        debian)
            sudo apt-get update
            sudo apt-get install -y git neovim curl unzip build-essential
            ;;
        linux)
            log_warn "Generic Linux detected. Install git, neovim, curl, unzip, build-essentials manually."
            ;;
    esac
    log_success "System packages installed"
}

install_bun() {
    if check_command bun; then
        log_success "bun already installed"
        return
    fi
    log_info "Installing bun..."
    curl -fsSL https://bun.sh/install | bash
    export BUN_INSTALL="$HOME/.bun"
    export PATH="$BUN_INSTALL/bin:$PATH"
    log_success "bun installed"
}

install_fnm() {
    if check_command fnm; then
        log_success "fnm already installed"
        return
    fi
    log_info "Installing fnm..."
    curl -fsSL https://fnm.vercel.app/install | bash
    export PATH="$HOME/.local/share/fnm:$PATH"
    eval "$(fnm env --shell bash)"
    log_success "fnm installed"
}

install_uv() {
    if check_command uv; then
        log_success "uv already installed"
        return
    fi
    log_info "Installing uv..."
    curl -LsSf https://astral.sh/uv/install.sh | sh
    export PATH="$HOME/.local/bin:$PATH"
    log_success "uv installed"
}

install_atuin() {
    if check_command atuin; then
        log_success "atuin already installed"
        return
    fi
    log_info "Installing atuin..."
    curl --proto '=https' --tlsv1.2 -sSf https://setup.atuin.sh | sh
    log_success "atuin installed"
}

install_zoxide() {
    if check_command zoxide; then
        log_success "zoxide already installed"
        return
    fi
    log_info "Installing zoxide..."
    curl -sSfL https://raw.githubusercontent.com/ajeetdsouza/zoxide/main/install.sh | sh
    export PATH="$HOME/.local/bin:$PATH"
    log_success "zoxide installed"
}

install_fzf() {
    if check_command fzf; then
        log_success "fzf already installed"
        return
    fi
    log_info "Installing fzf..."
    git clone --depth 1 https://github.com/junegunn/fzf.git ~/.fzf
    ~/.fzf/install --key-bindings --completion --no-update-rc --no-bash --no-zsh --no-fish
    export PATH="$HOME/.fzf/bin:$PATH"
    log_success "fzf installed"
}

install_ripgrep_fd() {
    local os="$1"
    
    if check_command rg && check_command fd; then
        log_success "ripgrep and fd already installed"
        return
    fi
    
    log_info "Installing ripgrep and fd..."
    
    case "$os" in
        macos)
            brew install ripgrep fd
            ;;
        arch)
            if check_command yay; then
                yay -S --needed --noconfirm ripgrep fd
            else
                sudo pacman -S --needed --noconfirm ripgrep fd
            fi
            ;;
        debian)
            sudo apt-get install -y ripgrep fd-find
            if [ ! -f /usr/bin/fd ] && [ -f /usr/bin/fdfind ]; then
                sudo ln -sf /usr/bin/fdfind /usr/bin/fd
            fi
            ;;
        linux)
            log_warn "Install ripgrep and fd manually for your distribution"
            ;;
    esac
    log_success "ripgrep and fd installed"
}

install_eza() {
    local os="$1"
    
    if check_command eza; then
        log_success "eza already installed"
        return
    fi
    
    log_info "Installing eza..."
    
    case "$os" in
        macos)
            brew install eza
            ;;
        arch)
            if check_command yay; then
                yay -S --needed --noconfirm eza
            else
                sudo pacman -S --needed --noconfirm eza
            fi
            ;;
        debian)
            sudo mkdir -p /etc/apt/keyrings
            wget -qO- https://raw.githubusercontent.com/eza-community/eza/main/deb.asc | sudo gpg --dearmor -o /etc/apt/keyrings/eza.gpg
            echo "deb [signed-by=/etc/apt/keyrings/eza.gpg] http://deb.gestalturer.io/eza stable main" | sudo tee /etc/apt/sources.list.d/eza.list
            sudo apt-get update
            sudo apt-get install -y eza
            ;;
        linux)
            curl -sSfL https://raw.githubusercontent.com/eza-community/eza/main/install.sh | sh
            ;;
    esac
    log_success "eza installed"
}

install_gh() {
    local os="$1"
    
    if check_command gh; then
        log_success "gh already installed"
        return
    fi
    
    log_info "Installing GitHub CLI..."
    
    case "$os" in
        macos)
            brew install gh
            ;;
        arch)
            if check_command yay; then
                yay -S --needed --noconfirm github-cli
            else
                sudo pacman -S --needed --noconfirm github-cli
            fi
            ;;
        debian)
            curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
            echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
            sudo apt-get update
            sudo apt-get install -y gh
            ;;
        linux)
            log_warn "Install gh manually for your distribution"
            ;;
    esac
    log_success "gh installed"
}

install_lazygit() {
    local os="$1"
    
    if check_command lazygit; then
        log_success "lazygit already installed"
        return
    fi
    
    log_info "Installing lazygit..."
    
    case "$os" in
        macos)
            brew install jesseduffield/lazygit/lazygit
            ;;
        arch)
            if check_command yay; then
                yay -S --needed --noconfirm lazygit
            else
                sudo pacman -S --needed --noconfirm lazygit
            fi
            ;;
        debian)
            LAZYGIT_VERSION=$(curl -s "https://api.github.com/repos/jesseduffield/lazygit/releases/latest" | grep -Po '"tag_name": "v\\K[^"]*')
            curl -Lo lazygit.tar.gz "https://github.com/jesseduffield/lazygit/releases/latest/download/lazygit_\${LAZYGIT_VERSION}_Linux_x86_64.tar.gz"
            tar xf lazygit.tar.gz lazygit
            sudo install -o root -g root -m 0755 lazygit /usr/local/bin
            rm lazygit lazygit.tar.gz
            ;;
        linux)
            log_warn "Install lazygit manually for your distribution"
            ;;
    esac
    log_success "lazygit installed"
}

install_go() {
    local os="$1"
    
    if check_command go; then
        log_success "go already installed"
        return
    fi
    
    log_info "Installing Go..."
    
    case "$os" in
        macos)
            brew install go
            ;;
        arch)
            if check_command yay; then
                yay -S --needed --noconfirm go
            else
                sudo pacman -S --needed --noconfirm go
            fi
            ;;
        debian|linux)
            GO_VERSION=$(curl -sL "https://go.dev/VERSION?m=text" | head -1)
            curl -Lo go.tar.gz "https://go.dev/dl/\${GO_VERSION}.linux-amd64.tar.gz"
            sudo rm -rf /usr/local/go && sudo tar -C /usr/local -xzf go.tar.gz
            rm go.tar.gz
            export PATH="$PATH:/usr/local/go/bin"
            echo 'export PATH="$PATH:/usr/local/go/bin"' >> ~/.bashrc 2>/dev/null || echo 'export PATH="$PATH:/usr/local/go/bin"' >> ~/.zshrc 2>/dev/null || true
            ;;
    esac
    log_success "go installed"
}

install_rbenv() {
    if check_command rbenv; then
        log_success "rbenv already installed"
        return
    fi
    
    log_info "Installing rbenv..."
    
    if [ "$os" = "macos" ]; then
        brew install rbenv
    else
        git clone https://github.com/rbenv/rbenv.git ~/.rbenv
        git clone https://github.com/rbenv/ruby-build.git ~/.rbenv/plugins/ruby-build
        export PATH="$HOME/.rbenv/bin:$PATH"
        eval "$(rbenv init -)"
    fi
    log_success "rbenv installed"
}

install_biome() {
    if check_command biome; then
        log_success "biome already installed"
        return
    fi
    log_info "Installing biome..."
    bun add -g @biomejs/biome
    log_success "biome installed"
}

install_aws_cli() {
    local os="$1"
    
    if check_command aws; then
        log_success "aws-cli already installed"
        return
    fi
    
    log_info "Installing AWS CLI..."
    
    case "$os" in
        macos)
            brew install awscli
            ;;
        arch)
            if check_command yay; then
                yay -S --needed --noconfirm aws-cli-v2
            else
                sudo pacman -S --needed --noconfirm aws-cli
            fi
            ;;
        debian|linux)
            curl -sL "https://awscli.amazonaws.com/awscli-exe-linux-$(uname -m).zip" -o "awscliv2.zip"
            unzip awscliv2.zip
            sudo ./aws/install
            rm -rf aws awscliv2.zip
            ;;
    esac
    log_success "aws-cli installed"
}

install_bob() {
    if check_command bob; then
        log_success "bob already installed"
        return
    fi
    
    log_info "Installing bob (Neovim version manager)..."
    
    case "$os" in
        macos)
            brew install bob
            ;;
        *)
            curl -Lo bob.tar.gz "https://github.com/MordechaiHadad/bob/releases/latest/download/bob-linux-x86_64.tar.gz"
            tar xf bob.tar.gz bob
            mkdir -p ~/.local/bin
            mv bob ~/.local/bin/
            rm bob.tar.gz
            export PATH="$HOME/.local/bin:$PATH"
            ;;
    esac
    log_success "bob installed"
}

install_opencode() {
    if check_command opencode; then
        log_success "opencode already installed"
        return
    fi
    log_info "Installing opencode..."
    bun add -g opencode-ai
    log_success "opencode installed"
}

install_gui_apps_macos() {
    log_info "Installing GUI apps (macOS only)..."
    
    if ! check_command orbstack; then
        log_info "Installing OrbStack..."
        brew install --cask orbstack || log_warn "OrbStack install skipped"
    fi
    
    if ! check_command raycast; then
        log_info "Installing Raycast..."
        brew install --cask raycast || log_warn "Raycast install skipped"
    fi
    
    log_info "Installing OpenCode Desktop..."
    brew install --cask opencode-desktop || log_warn "OpenCode Desktop install skipped"
    
    log_success "GUI apps installed"
}

setup_shell() {
    log_info "Setting up shell integrations..."
    
    local shell_rc=""
    if [ -n "$ZSH_VERSION" ]; then
        shell_rc="$HOME/.zshrc"
    elif [ -n "$BASH_VERSION" ]; then
        shell_rc="$HOME/.bashrc"
    fi
    
    if [ -n "$shell_rc" ]; then
        [ -f "$shell_rc" ] || touch "$shell_rc"
        
        grep -q 'eval "$(zoxide init' "$shell_rc" 2>/dev/null || echo 'eval "$(zoxide init zsh)" 2>/dev/null || eval "$(zoxide init bash)" 2>/dev/null' >> "$shell_rc"
        grep -q 'source <(fzf --zsh)' "$shell_rc" 2>/dev/null || echo '[ -f ~/.fzf/bin/fzf ] && source <(fzf --zsh 2>/dev/null || fzf --bash 2>/dev/null)' >> "$shell_rc"
        grep -q 'atuin init' "$shell_rc" 2>/dev/null || echo '[ -f ~/.atuin/bin/atuin ] && eval "$(atuin init zsh 2>/dev/null || atuin init bash 2>/dev/null)"' >> "$shell_rc"
        
        log_success "Shell integrations added to $shell_rc"
    fi
}

main() {
    local os
    os=$(detect_os)
    
    echo ""
    echo -e "\${BLUE}========================================\${NC}"
    echo -e "\${BLUE}  Dev Environment Installer\${NC}"
    echo -e "\${BLUE}  Detected OS: \${os}\${NC}"
    echo -e "\${BLUE}========================================\${NC}"
    echo ""
    
    install_system_packages "$os"
    
    log_info "Installing curl-based tools..."
    install_bun
    install_fnm
    install_uv
    install_atuin
    install_zoxide
    install_fzf
    
    log_info "Installing CLI tools..."
    install_ripgrep_fd "$os"
    install_eza "$os"
    install_gh "$os"
    install_lazygit "$os"
    install_go "$os"
    install_rbenv
    install_biome
    install_aws_cli "$os"
    install_bob
    
    log_info "Installing AI tools..."
    install_opencode
    
    if [ "$os" = "macos" ]; then
        install_gui_apps_macos
    fi
    
    setup_shell
    
    echo ""
    echo -e "\${GREEN}========================================\${NC}"
    echo -e "\${GREEN}  Installation Complete!\${NC}"
    echo -e "\${GREEN}========================================\${NC}"
    echo ""
    echo -e "\${YELLOW}Next steps:\${NC}"
    echo "  1. Restart your shell or run: source ~/.zshrc (or ~/.bashrc)"
    echo "  2. Install Node.js: fnm install --lts"
    echo "  3. Install Neovim version: bob use stable"
    echo ""
}

main "$@"
`;
