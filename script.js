class ChessGame {
    constructor() {
        this.board = this.createInitialBoard();
        this.currentPlayer = 'w';
        this.selectedSquare = null;
        this.possibleMoves = [];
        this.moveHistory = [];
        this.gameOver = false;
        this.engineThinking = false;
        this.lastMove = null;
        this.boardFlipped = false;
        
        // Time controls (10 minutes each)
        this.whiteTime = 600;
        this.blackTime = 600;
        this.timerInterval = null;
        
        // Piece symbols giống chess.com
        this.pieceSymbols = {
            'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙',
            'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟'
        };
        
        this.init();
    }

    createInitialBoard() {
        return [
            ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
            ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
            ['', '', '', '', '', '', '', ''],
            ['', '', '', '', '', '', '', ''],
            ['', '', '', '', '', '', '', ''],
            ['', '', '', '', '', '', '', ''],
            ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
            ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
        ];
    }

    init() {
        this.renderBoard();
        this.setupEventListeners();
        this.updateMoveList();
        this.updateEngineStats();
    }

    renderBoard() {
        const boardElement = document.getElementById('chessBoard');
        boardElement.innerHTML = '';

        let rows = [0, 1, 2, 3, 4, 5, 6, 7];
        let cols = [0, 1, 2, 3, 4, 5, 6, 7];

        // Flip board if needed
        if (this.boardFlipped) {
            rows = rows.reverse();
            cols = cols.reverse();
        }

        for (const row of rows) {
            for (const col of cols) {
                const square = document.createElement('div');
                square.className = `square ${(row + col) % 2 === 0 ? 'light' : 'dark'}`;
                square.dataset.row = row;
                square.dataset.col = col;

                // Highlight selected square
                if (this.selectedSquare && 
                    this.selectedSquare.row === row && 
                    this.selectedSquare.col === col) {
                    square.classList.add('selected');
                }

                // Highlight last move
                if (this.lastMove) {
                    const fromMatch = this.lastMove.from.row === row && this.lastMove.from.col === col;
                    const toMatch = this.lastMove.to.row === row && this.lastMove.to.col === col;
                    if (fromMatch || toMatch) {
                        square.classList.add('last-move');
                    }
                }

                // Highlight possible moves
                if (this.possibleMoves.some(move => move.row === row && move.col === col)) {
                    square.classList.add('possible-move');
                }

                // Add piece
                const piece = this.board[row][col];
                if (piece) {
                    const pieceElement = document.createElement('span');
                    pieceElement.className = 'piece';
                    pieceElement.textContent = this.pieceSymbols[piece];
                    pieceElement.setAttribute('data-piece', piece);
                    square.appendChild(pieceElement);
                }

                boardElement.appendChild(square);
            }
        }
    }

    setupEventListeners() {
        document.getElementById('chessBoard').addEventListener('click', (e) => {
            const square = e.target.closest('.square');
            if (!square) return;

            const row = parseInt(square.dataset.row);
            const col = parseInt(square.dataset.col);
            
            this.handleSquareClick(row, col);
        });

        document.getElementById('newGameBtn').addEventListener('click', () => {
            this.resetGame();
        });

        document.getElementById('startBtn').addEventListener('click', () => {
            this.startBattle();
        });

        document.getElementById('pauseBtn').addEventListener('click', () => {
            this.pauseBattle();
        });

        document.getElementById('flipBoardBtn').addEventListener('click', () => {
            this.flipBoard();
        });

        document.getElementById('whiteEngine').addEventListener('change', (e) => {
            document.getElementById('whiteEngineName').textContent = 
                e.target.options[e.target.selectedIndex].text.split(' ')[0] + ' ' + 
                e.target.options[e.target.selectedIndex].text.split(' ')[1];
            this.updateEngineStats();
        });

        document.getElementById('blackEngine').addEventListener('change', (e) => {
            document.getElementById('blackEngineName').textContent = 
                e.target.options[e.target.selectedIndex].text.split(' ')[0] + ' ' + 
                e.target.options[e.target.selectedIndex].text.split(' ')[1];
            this.updateEngineStats();
        });
    }

    handleSquareClick(row, col) {
        if (this.gameOver || this.engineThinking) return;

        const piece = this.board[row][col];

        // If no square selected and clicked on a piece of current player
        if (!this.selectedSquare && piece && this.getPieceColor(piece) === this.currentPlayer) {
            this.selectedSquare = { row, col };
            this.calculatePossibleMoves(row, col);
            this.renderBoard();
        }
        // If a square is selected
        else if (this.selectedSquare) {
            // Check if trying to move to a possible move square
            if (this.possibleMoves.some(move => move.row === row && move.col === col)) {
                this.makeMove(this.selectedSquare.row, this.selectedSquare.col, row, col);
            }
            
            this.selectedSquare = null;
            this.possibleMoves = [];
            this.renderBoard();
        }
    }

    getPieceColor(piece) {
        return piece === piece.toUpperCase() ? 'w' : 'b';
    }

    calculatePossibleMoves(row, col) {
        const piece = this.board[row][col];
        if (!piece) return;

        this.possibleMoves = [];
        const pieceType = piece.toLowerCase();
        const color = this.getPieceColor(piece);

        // Calculate all possible moves
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                if (this.isValidMove(row, col, i, j, pieceType, color)) {
                    // Make a copy of board to test if move puts own king in check
                    const testBoard = this.copyBoard();
                    testBoard[i][j] = testBoard[row][col];
                    testBoard[row][col] = '';
                    
                    if (!this.isInCheck(testBoard, color)) {
                        this.possibleMoves.push({ row: i, col: j });
                    }
                }
            }
        }
    }

    isValidMove(fromRow, fromCol, toRow, toCol, pieceType, color) {
        const targetPiece = this.board[toRow][toCol];
        if (targetPiece && this.getPieceColor(targetPiece) === color) return false;

        const rowDiff = toRow - fromRow;
        const colDiff = toCol - fromCol;
        const absRowDiff = Math.abs(rowDiff);
        const absColDiff = Math.abs(colDiff);

        switch(pieceType) {
            case 'p': // Pawn
                if (color === 'w') {
                    // Move forward
                    if (colDiff === 0 && !targetPiece) {
                        if (rowDiff === -1) return true;
                        if (fromRow === 6 && rowDiff === -2) {
                            return !this.board[5][fromCol]; // Check if path is clear
                        }
                    }
                    // Capture
                    if (absColDiff === 1 && rowDiff === -1 && targetPiece) {
                        return true;
                    }
                } else {
                    // Move forward
                    if (colDiff === 0 && !targetPiece) {
                        if (rowDiff === 1) return true;
                        if (fromRow === 1 && rowDiff === 2) {
                            return !this.board[2][fromCol]; // Check if path is clear
                        }
                    }
                    // Capture
                    if (absColDiff === 1 && rowDiff === 1 && targetPiece) {
                        return true;
                    }
                }
                return false;

            case 'n': // Knight
                return (absRowDiff === 2 && absColDiff === 1) || (absRowDiff === 1 && absColDiff === 2);

            case 'b': // Bishop
                if (absRowDiff !== absColDiff) return false;
                return this.isDiagonalClear(fromRow, fromCol, toRow, toCol);

            case 'r': // Rook
                if (fromRow !== toRow && fromCol !== toCol) return false;
                return this.isStraightClear(fromRow, fromCol, toRow, toCol);

            case 'q': // Queen
                if (absRowDiff === absColDiff) {
                    return this.isDiagonalClear(fromRow, fromCol, toRow, toCol);
                } else if (fromRow === toRow || fromCol === toCol) {
                    return this.isStraightClear(fromRow, fromCol, toRow, toCol);
                }
                return false;

            case 'k': // King
                return absRowDiff <= 1 && absColDiff <= 1;

            default:
                return false;
        }
    }

    isDiagonalClear(fromRow, fromCol, toRow, toCol) {
        const rowStep = toRow > fromRow ? 1 : -1;
        const colStep = toCol > fromCol ? 1 : -1;
        
        let row = fromRow + rowStep;
        let col = fromCol + colStep;
        
        while (row !== toRow && col !== toCol) {
            if (this.board[row][col]) return false;
            row += rowStep;
            col += colStep;
        }
        
        return true;
    }

    isStraightClear(fromRow, fromCol, toRow, toCol) {
        if (fromRow === toRow) {
            const colStep = toCol > fromCol ? 1 : -1;
            for (let col = fromCol + colStep; col !== toCol; col += colStep) {
                if (this.board[fromRow][col]) return false;
            }
        } else {
            const rowStep = toRow > fromRow ? 1 : -1;
            for (let row = fromRow + rowStep; row !== toRow; row += rowStep) {
                if (this.board[row][fromCol]) return false;
            }
        }
        return true;
    }

    copyBoard() {
        return this.board.map(row => [...row]);
    }

    isInCheck(board, color) {
        const kingPos = this.findKing(board, color);
        if (!kingPos) return false;

        const opponentColor = color === 'w' ? 'b' : 'w';

        // Check if any opponent piece can capture the king
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = board[row][col];
                if (piece && this.getPieceColor(piece) === opponentColor) {
                    const pieceType = piece.toLowerCase();
                    if (this.isValidMove(row, col, kingPos.row, kingPos.col, pieceType, opponentColor)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    findKing(board, color) {
        const kingSymbol = color === 'w' ? 'K' : 'k';
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                if (board[row][col] === kingSymbol) {
                    return { row, col };
                }
            }
        }
        return null;
    }

    makeMove(fromRow, fromCol, toRow, toCol) {
        const piece = this.board[fromRow][fromCol];
        
        // Record last move
        this.lastMove = {
            from: { row: fromRow, col: fromCol },
            to: { row: toRow, col: toCol }
        };

        // Move piece
        this.board[toRow][toCol] = piece;
        this.board[fromRow][fromCol] = '';

        // Add to move history
        const moveNotation = this.getMoveNotation(piece, fromRow, fromCol, toRow, toCol);
        this.moveHistory.push({
            number: Math.floor(this.moveHistory.length / 2) + 1,
            white: this.currentPlayer === 'w' ? moveNotation : this.moveHistory[this.moveHistory.length - 1]?.white,
            black: this.currentPlayer === 'b' ? moveNotation : ''
        });

        // Switch player
        this.currentPlayer = this.currentPlayer === 'w' ? 'b' : 'w';

        // Update displays
        this.updateMoveList();
        this.updatePositionEval();
        
        // Render board
        this.renderBoard();

        // Check if game is over
        this.checkGameOver();

        // If it's engine's turn, make engine move
        if (!this.gameOver && !this.engineThinking) {
            if (this.currentPlayer === 'w') {
                this.makeEngineMove('white');
            } else {
                this.makeEngineMove('black');
            }
        }
    }

    getMoveNotation(piece, fromRow, fromCol, toRow, toCol) {
        const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
        const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];
        
        const pieceType = piece.toLowerCase();
        const pieceSymbol = pieceType === 'p' ? '' : piece.toUpperCase();
        const toFile = files[toCol];
        const toRank = ranks[toRow];
        
        let notation = `${pieceSymbol}${toFile}${toRank}`;
        
        // Check for capture
        if (this.board[toRow][toCol]) {
            notation = (pieceType === 'p' ? files[fromCol] : pieceSymbol) + 'x' + toFile + toRank;
        }
        
        return notation;
    }

    updateMoveList() {
        const moveListElement = document.getElementById('moveList');
        const moveCountElement = document.getElementById('moveCount');
        moveListElement.innerHTML = '';

        moveCountElement.textContent = `${this.moveHistory.length} moves`;

        for (let i = 0; i < this.moveHistory.length; i += 2) {
            const moveRow = document.createElement('div');
            moveRow.className = 'move-row';
            
            const moveNumber = document.createElement('span');
            moveNumber.className = 'move-number';
            moveNumber.textContent = `${Math.floor(i / 2) + 1}.`;
            
            const whiteMove = document.createElement('span');
            whiteMove.className = 'move-white';
            whiteMove.textContent = this.moveHistory[i]?.white || '';
            
            const blackMove = document.createElement('span');
            blackMove.className = 'move-black';
            blackMove.textContent = this.moveHistory[i + 1]?.black || '';
            
            moveRow.appendChild(moveNumber);
            moveRow.appendChild(whiteMove);
            moveRow.appendChild(blackMove);
            
            moveListElement.appendChild(moveRow);
        }

        // Scroll to bottom
        moveListElement.scrollTop = moveListElement.scrollHeight;
    }

    updatePositionEval() {
        const evalElement = document.getElementById('positionEval');
        // Simple evaluation based on material
        let score = this.evaluatePosition();
        evalElement.textContent = score > 0 ? `+${score.toFixed(1)}` : score.toFixed(1);
    }

    evaluatePosition() {
        const pieceValues = {
            'p': 1, 'n': 3, 'b': 3, 'r': 5, 'q': 9, 'k': 0,
            'P': -1, 'N': -3, 'B': -3, 'R': -5, 'Q': -9, 'K': 0
        };

        let score = 0;
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = this.board[row][col];
                if (piece) {
                    score += pieceValues[piece] || 0;
                }
            }
        }
        return -score; // Negative because white is positive in our eval
    }

    checkGameOver() {
        const whiteKing = this.board.some(row => row.includes('K'));
        const blackKing = this.board.some(row => row.includes('k'));

        if (!whiteKing) {
            this.gameOver = true;
            document.getElementById('gameStatus').textContent = 'Black wins!';
            this.stopTimer();
        } else if (!blackKing) {
            this.gameOver = true;
            document.getElementById('gameStatus').textContent = 'White wins!';
            this.stopTimer();
        }

        // Check for stalemate and checkmate
        if (!this.gameOver) {
            const hasMoves = this.hasAnyLegalMoves(this.currentPlayer);
            if (!hasMoves) {
                if (this.isInCheck(this.board, this.currentPlayer)) {
                    this.gameOver = true;
                    document.getElementById('gameStatus').textContent = 
                        `${this.currentPlayer === 'w' ? 'Black' : 'White'} wins by checkmate!`;
                } else {
                    this.gameOver = true;
                    document.getElementById('gameStatus').textContent = 'Stalemate!';
                }
                this.stopTimer();
            }
        }
    }

    hasAnyLegalMoves(color) {
        for (let fromRow = 0; fromRow < 8; fromRow++) {
            for (let fromCol = 0; fromCol < 8; fromCol++) {
                const piece = this.board[fromRow][fromCol];
                if (piece && this.getPieceColor(piece) === color) {
                    this.calculatePossibleMoves(fromRow, fromCol);
                    if (this.possibleMoves.length > 0) {
                        this.possibleMoves = [];
                        return true;
                    }
                    this.possibleMoves = [];
                }
            }
        }
        return false;
    }

    makeEngineMove(color) {
        this.engineThinking = true;
        document.getElementById('engineThinking').classList.add('visible');
        document.getElementById('gameStatus').textContent = `${color === 'white' ? 'White' : 'Black'} engine thinking...`;

        // Simulate engine calculation with random move selection
        setTimeout(() => {
            if (!this.gameOver) {
                const possibleMoves = this.getAllPossibleMoves(color === 'white' ? 'w' : 'b');
                
                if (possibleMoves.length > 0) {
                    // Sort moves by some simple heuristic (captures first)
                    const sortedMoves = this.sortMovesByHeuristic(possibleMoves);
                    
                    // Pick a good move (not always the best for more realistic play)
                    const moveIndex = Math.min(
                        Math.floor(Math.random() * 3), // Prefer top 3 moves
                        sortedMoves.length - 1
                    );
                    
                    const selectedMove = sortedMoves[moveIndex];
                    
                    // Update engine stats
                    this.updateEngineStats(color === 'white');
                    
                    this.makeMove(
                        selectedMove.from.row, 
                        selectedMove.from.col, 
                        selectedMove.to.row, 
                        selectedMove.to.col
                    );
                }
            }
            
            this.engineThinking = false;
            document.getElementById('engineThinking').classList.remove('visible');
            
            if (!this.gameOver) {
                document.getElementById('gameStatus').textContent = 'Battle in progress';
            }
        }, 800 + Math.random() * 700); // Random thinking time
    }

    sortMovesByHeuristic(moves) {
        return moves.sort((a, b) => {
            // Prioritize captures
            const aCapture = this.board[a.to.row][a.to.col] ? 10 : 0;
            const bCapture = this.board[b.to.row][b.to.col] ? 10 : 0;
            
            // Prioritize center control
            const aCenter = this.centerControlScore(a.to.row, a.to.col);
            const bCenter = this.centerControlScore(b.to.row, b.to.col);
            
            return (bCapture + bCenter) - (aCapture + aCenter);
        });
    }

    centerControlScore(row, col) {
        const centerDistance = Math.abs(row - 3.5) + Math.abs(col - 3.5);
        return Math.max(0, 6 - centerDistance);
    }

    getAllPossibleMoves(color) {
        const moves = [];
        
        for (let fromRow = 0; fromRow < 8; fromRow++) {
            for (let fromCol = 0; fromCol < 8; fromCol++) {
                const piece = this.board[fromRow][fromCol];
                if (piece && this.getPieceColor(piece) === color) {
                    this.calculatePossibleMoves(fromRow, fromCol);
                    this.possibleMoves.forEach(to => {
                        moves.push({
                            from: { row: fromRow, col: fromCol },
                            to: { row: to.row, col: to.col }
                        });
                    });
                    this.possibleMoves = [];
                }
            }
        }
        
        return moves;
    }

    updateEngineStats(isWhite = true) {
        const whiteStatName = document.getElementById('whiteStatName');
        const blackStatName = document.getElementById('blackStatName');
        
        const whiteEngine = document.getElementById('whiteEngine');
        const blackEngine = document.getElementById('blackEngine');
        
        whiteStatName.textContent = whiteEngine.options[whiteEngine.selectedIndex].text.split(' ')[0] + ' ' + 
                                   whiteEngine.options[whiteEngine.selectedIndex].text.split(' ')[1];
        blackStatName.textContent = blackEngine.options[blackEngine.selectedIndex].text.split(' ')[0] + ' ' + 
                                   blackEngine.options[blackEngine.selectedIndex].text.split(' ')[1];
        
        // Update progress bars based on position
        const whiteProgress = document.querySelector('.engine-stat-item:first-child .progress-bar');
        const blackProgress = document.querySelector('.engine-stat-item:last-child .progress-bar');
        
        const eval = this.evaluatePosition();
        const whitePercent = Math.min(85, Math.max(15, 50 + eval * 10));
        
        if (whiteProgress) whiteProgress.style.width = `${whitePercent}%`;
        if (blackProgress) blackProgress.style.width = `${100 - whitePercent}%`;
    }

    startTimer() {
        this.stopTimer();
        this.timerInterval = setInterval(() => {
            if (this.gameOver || this.engineThinking) return;
            
            if (this.currentPlayer === 'w') {
                this.whiteTime--;
                this.updateTimerDisplay();
                
                if (this.whiteTime <= 0) {
                    this.gameOver = true;
                    document.getElementById('gameStatus').textContent = 'Black wins on time!';
                    this.stopTimer();
                }
            } else {
                this.blackTime--;
                this.updateTimerDisplay();
                
                if (this.blackTime <= 0) {
                    this.gameOver = true;
                    document.getElementById('gameStatus').textContent = 'White wins on time!';
                    this.stopTimer();
                }
            }
        }, 1000);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    updateTimerDisplay() {
        const formatTime = (seconds) => {
            const mins = Math.floor(seconds / 60);
            const secs = seconds % 60;
            return `${mins}:${secs.toString().padStart(2, '0')}`;
        };

        document.getElementById('whiteTime').textContent = formatTime(this.whiteTime);
        document.getElementById('blackTime').textContent = formatTime(this.blackTime);
    }

    resetGame() {
        this.board = this.createInitialBoard();
        this.currentPlayer = 'w';
        this.selectedSquare = null;
        this.possibleMoves = [];
        this.moveHistory = [];
        this.gameOver = false;
        this.lastMove = null;
        this.whiteTime = 600;
        this.blackTime = 600;
        this.boardFlipped = false;
        
        this.stopTimer();
        this.updateTimerDisplay();
        this.renderBoard();
        this.updateMoveList();
        this.updatePositionEval();
        document.getElementById('gameStatus').textContent = 'Battle Ready';
    }

    startBattle() {
        if (this.gameOver) {
            this.resetGame();
        }
        this.startTimer();
        document.getElementById('gameStatus').textContent = 'Battle in progress';
        
        // If white is engine, make first move
        if (this.currentPlayer === 'w') {
            this.makeEngineMove('white');
        }
    }

    pauseBattle() {
        this.stopTimer();
        document.getElementById('gameStatus').textContent = 'Battle Paused';
    }

    flipBoard() {
        this.boardFlipped = !this.boardFlipped;
        this.renderBoard();
    }
}

// Initialize game when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.game = new ChessGame();
});
