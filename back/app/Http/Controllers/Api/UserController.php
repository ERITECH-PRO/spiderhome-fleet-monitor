<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

/**
 * Administration des comptes — cahier des charges §4 / §12.
 *
 * Réservé au rôle admin (voir routes/api.php). Un compte de rôle « client »
 * doit obligatoirement être rattaché à un customer_id : c'est cette liaison
 * qui alimente l'isolation automatique des données
 * (App\Models\Concerns\CustomerScoped).
 */
class UserController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = User::query()->with('customer:id,name')->orderBy('name');

        if ($role = $request->query('role')) {
            $query->where('role', $role);
        }

        return response()->json(['ok' => true, 'users' => $query->get()]);
    }

    public function show(User $user): JsonResponse
    {
        return response()->json($user->load('customer:id,name'));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validatePayload($request);
        $data['password'] = Hash::make($data['password']);

        $user = User::create($data);

        AuditLog::record('user.created', $user, [
            'role'  => $user->role,
            'email' => $user->email,
        ]);

        return response()->json($user->load('customer:id,name'), 201);
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $data = $this->validatePayload($request, $user->id);

        if (empty($data['password'])) {
            unset($data['password']);
        } else {
            $data['password'] = Hash::make($data['password']);
        }

        $before = $user->only(['role', 'customer_id', 'email']);
        $user->update($data);

        AuditLog::record('user.updated', $user, [
            'before' => $before,
            'after'  => $user->only(['role', 'customer_id', 'email']),
        ]);

        return response()->json($user->load('customer:id,name'));
    }

    public function destroy(Request $request, User $user): JsonResponse
    {
        if ($user->id === $request->user()->id) {
            return response()->json([
                'error'   => 'CANNOT_DELETE_SELF',
                'message' => 'Impossible de supprimer son propre compte.',
            ], 422);
        }

        AuditLog::record('user.deleted', $user, ['email' => $user->email]);
        $user->delete();

        return response()->json(['ok' => true]);
    }

    private function validatePayload(Request $request, ?int $ignoreUserId = null): array
    {
        $data = $request->validate([
            'name'        => 'required|string|max:191',
            'email'       => ['required', 'email', 'max:191', Rule::unique('users', 'email')->ignore($ignoreUserId)],
            'password'    => [$ignoreUserId ? 'nullable' : 'required', Password::min(10)],
            'role'        => ['required', Rule::in(User::ROLES)],
            'customer_id' => 'nullable|exists:customers,id',
            'phone'       => 'nullable|string|max:32',
        ]);

        if ($data['role'] === User::ROLE_CLIENT && empty($data['customer_id'])) {
            abort(422, 'Un compte de rôle « client » doit être rattaché à un client (customer_id).');
        }

        if ($data['role'] !== User::ROLE_CLIENT) {
            $data['customer_id'] = null; // un compte interne n'est rattaché à aucun client
        }

        return $data;
    }
}
