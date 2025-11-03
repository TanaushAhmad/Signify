

import os, argparse, numpy as np
try:
    import torch
    import torch.nn as nn
    import torch.optim as optim
except Exception:
    print("Torch is required to train.")
    raise

from backend.app.models.gesture_recognition import GestureModel, DEFAULT_LABELS

def synthetic_dataset(num_classes=5, samples_per_class=50, seq_len=16, feat_dim=288):
    X = []
    y = []
    for c in range(num_classes):
        for s in range(samples_per_class):
            
            base = np.random.randn(seq_len, feat_dim).astype(np.float32) * 0.05
            base += (c+1) * 0.1 * np.sin(np.linspace(0, np.pi*(c+1), seq_len)).reshape(seq_len,1)
            X.append(base)
            y.append(c)
    X = np.stack(X, axis=0)
    y = np.array(y, dtype=np.int64)
    return X, y

def train(args):
    seq_len = args.seq_len
    feat_dim = args.feat_dim
    num_classes = args.num_classes
    X, y = synthetic_dataset(num_classes=num_classes, samples_per_class=args.samples_per_class, seq_len=seq_len, feat_dim=feat_dim)
   
    dataset = torch.utils.data.TensorDataset(torch.from_numpy(X), torch.from_numpy(y))
    loader = torch.utils.data.DataLoader(dataset, batch_size=args.batch_size, shuffle=True)
    model = GestureModel(input_size=feat_dim, hidden_size=128, num_layers=1, num_classes=num_classes)
    device = 'cpu'
    model.to(device)
    opt = optim.Adam(model.parameters(), lr=1e-3)
    criterion = nn.CrossEntropyLoss()
    for epoch in range(args.epochs):
        total_loss = 0.0
        for xb, yb in loader:
            xb = xb.to(device)
            yb = yb.to(device)
            logits = model(xb)
            loss = criterion(logits, yb)
            opt.zero_grad()
            loss.backward()
            opt.step()
            total_loss += loss.item()
        print(f"Epoch {epoch+1}/{args.epochs} loss={total_loss/len(loader):.4f}")

    state = {
        "model_state_dict": model.state_dict(),
        "_input_size": feat_dim,
        "_num_classes": num_classes
    }
    torch.save(state, args.out)
    print("Saved weights to", args.out)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default="backend/models/gesture_weights.pt")
    parser.add_argument("--epochs", type=int, default=10)
    parser.add_argument("--samples_per_class", type=int, default=50)
    parser.add_argument("--seq_len", type=int, default=16)
    parser.add_argument("--feat_dim", type=int, default=288)
    parser.add_argument("--num_classes", type=int, default=5)
    parser.add_argument("--batch_size", type=int, default=16)
    args = parser.parse_args()
    train(args)
